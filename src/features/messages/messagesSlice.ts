import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getErrorMessage, greenApi } from '../../api/greenApi';
import type { HistoryMessage } from '../../api/types';
import { createAppAsyncThunk } from '../../app/createAppAsyncThunk';
import type { RootState } from '../../app/store';
import { loggedOut, selectCredentials } from '../auth/authSlice';

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  chatId: string;
  text: string;
  /** Unix-время в миллисекундах. */
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  /** Только для исходящих сообщений. */
  status: MessageStatus | null;
  error?: string;
}

/** Данные о чате, которые приходят вместе с сообщением из уведомления. */
export interface ChatInfo {
  id: string;
  name: string;
  phone: string | null;
}

type LoadStatus = 'loading' | 'loaded' | 'failed';

interface StatusUpdate {
  status: MessageStatus;
  error?: string;
}

export interface MessagesState {
  byChat: Record<string, Message[]>;
  historyStatus: Record<string, LoadStatus>;
  recentStatus: LoadStatus | 'idle';
  /**
   * Статусы, пришедшие раньше самого сообщения: outgoingMessageStatus может обогнать
   * и ответ SendMessage, и эхо-уведомление. Применяются, когда сообщение появится.
   */
  earlyStatuses: Record<string, StatusUpdate>;
}

export const messagesInitialState: MessagesState = {
  byChat: {},
  historyStatus: {},
  recentStatus: 'idle',
  earlyStatuses: {},
};

const HISTORY_SIZE = 50;
/** Статусы сообщений, отправленных с телефона в незагруженные чаты, иначе копились бы бесконечно. */
const EARLY_STATUSES_LIMIT = 100;
/** За сколько предыдущих дней журналы восстанавливают чаты при входе. */
const RECENT_DAYS = 3;

/** Период в минутах от начала дня `days` дней назад, чтобы самый ранний день попал целиком. */
function minutesSinceStartOfDay(days: number): number {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((Date.now() - start.getTime()) / 60_000);
}

/** Чат, восстановленный из журналов сообщений. */
export interface RecentChat {
  id: string;
  /** Журналы содержат имя только во входящих сообщениях. */
  name: string | null;
  lastActivity: number;
}

const LOCAL_ID_PREFIX = 'local:';
const localId = (requestId: string) => `${LOCAL_ID_PREFIX}${requestId}`;

const STATUS_RANK: Record<MessageStatus, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 0 };

function nextStatus(current: MessageStatus | null, incoming: MessageStatus | null): MessageStatus | null {
  if (!incoming || !current) return current ?? incoming;
  if (incoming === 'failed') return current === 'pending' || current === 'sent' ? 'failed' : current;
  return STATUS_RANK[incoming] > STATUS_RANK[current] ? incoming : current;
}

function applyStatus(message: Message, { status, error }: StatusUpdate) {
  message.status = nextStatus(message.status, status);
  if (message.status === 'failed' && error) message.error = error;
}

function applyEarlyStatus(state: MessagesState, message: Message) {
  const early = state.earlyStatuses[message.id];
  if (!early) return;
  applyStatus(message, early);
  delete state.earlyStatuses[message.id];
}

function rememberEarlyStatus(state: MessagesState, id: string, update: StatusUpdate) {
  const ids = Object.keys(state.earlyStatuses);
  if (ids.length >= EARLY_STATUSES_LIMIT) delete state.earlyStatuses[ids[0]];
  state.earlyStatuses[id] = update;
}

/** Добавляет сообщение с сохранением сортировки по времени или обновляет статус существующего. */
function upsertMessage(state: MessagesState, message: Message) {
  const list = (state.byChat[message.chatId] ??= []);
  const existing = list.find((item) => item.id === message.id);
  if (existing) {
    existing.status = nextStatus(existing.status, message.status);
    applyEarlyStatus(state, existing);
    return;
  }

  let index = list.length;
  while (index > 0 && list[index - 1].timestamp > message.timestamp) index -= 1;
  list.splice(index, 0, message);
  applyEarlyStatus(state, list[index]);
}

function historyItemToMessage(item: HistoryMessage): Message | null {
  const text = item.textMessage ?? item.extendedTextMessage?.text;
  if (item.typeMessage !== 'textMessage' && item.typeMessage !== 'extendedTextMessage') return null;
  if (!text) return null;

  const outgoing = item.type === 'outgoing';
  const status = item.statusMessage;
  return {
    id: item.idMessage,
    chatId: item.chatId,
    text,
    timestamp: item.timestamp * 1000,
    direction: outgoing ? 'outgoing' : 'incoming',
    status: outgoing ? (status === 'delivered' || status === 'read' ? status : 'sent') : null,
  };
}

export const sendMessage = createAppAsyncThunk(
  'messages/send',
  async ({ chatId, text }: { chatId: string; text: string }, { getState, rejectWithValue }) => {
    const credentials = selectCredentials(getState());
    if (!credentials) return rejectWithValue('Требуется авторизация');

    try {
      const { idMessage } = await greenApi.sendMessage(credentials, chatId, text);
      return idMessage;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchHistory = createAppAsyncThunk(
  'messages/fetchHistory',
  async (chatId: string, { getState, rejectWithValue }) => {
    const credentials = selectCredentials(getState());
    if (!credentials) return rejectWithValue('Требуется авторизация');

    try {
      const history = await greenApi.getChatHistory(credentials, chatId, HISTORY_SIZE);
      return (history ?? []).map(historyItemToMessage).filter((message) => message !== null);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
  {
    condition: (chatId, { getState }) => {
      const status = getState().messages.historyStatus[chatId];
      return status !== 'loading' && status !== 'loaded';
    },
  },
);

export const fetchRecentMessages = createAppAsyncThunk(
  'messages/fetchRecent',
  async (_: void, { getState, rejectWithValue }) => {
    const credentials = selectCredentials(getState());
    if (!credentials) return rejectWithValue('Требуется авторизация');

    try {
      const minutes = minutesSinceStartOfDay(RECENT_DAYS);
      const [incoming, outgoing] = await Promise.all([
        greenApi.lastIncomingMessages(credentials, minutes),
        greenApi.lastOutgoingMessages(credentials, minutes),
      ]);

      const chats = new Map<string, RecentChat>();
      const messages: Message[] = [];
      for (const item of [...(incoming ?? []), ...(outgoing ?? [])]) {
        if (item.chatType && item.chatType !== 'user') continue;
        const message = historyItemToMessage(item);
        if (!message) continue;
        messages.push(message);

        const chat = chats.get(item.chatId) ?? { id: item.chatId, name: null, lastActivity: 0 };
        chat.lastActivity = Math.max(chat.lastActivity, message.timestamp);
        if (item.type === 'incoming' && !chat.name) chat.name = item.senderContactName || item.senderName || null;
        chats.set(item.chatId, chat);
      }
      return { chats: [...chats.values()], messages };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
  {
    condition: (_, { getState }) => {
      const status = getState().messages.recentStatus;
      return status === 'idle' || status === 'failed';
    },
  },
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState: messagesInitialState,
  reducers: {
    messageReceived: (state, action: PayloadAction<{ chat: ChatInfo; message: Message }>) => {
      upsertMessage(state, action.payload.message);
    },
    messageStatusChanged: (
      state,
      action: PayloadAction<{ chatId: string; id: string; status: MessageStatus; error?: string }>,
    ) => {
      const { chatId, id, status, error } = action.payload;
      const message = state.byChat[chatId]?.find((item) => item.id === id);
      if (message) applyStatus(message, { status, error });
      else rememberEarlyStatus(state, id, { status, error });
    },
    messageRemoved: (state, action: PayloadAction<{ chatId: string; id: string }>) => {
      const { chatId, id } = action.payload;
      const list = state.byChat[chatId];
      if (list) state.byChat[chatId] = list.filter((item) => item.id !== id);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loggedOut, () => messagesInitialState)
      .addCase(sendMessage.pending, (state, action) => {
        const { chatId, text } = action.meta.arg;
        upsertMessage(state, {
          id: localId(action.meta.requestId),
          chatId,
          text,
          timestamp: Date.now(),
          direction: 'outgoing',
          status: 'pending',
        });
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const list = state.byChat[action.meta.arg.chatId];
        if (!list) return;
        const pendingId = localId(action.meta.requestId);
        // Эхо-уведомление outgoingAPIMessageReceived могло прийти раньше ответа SendMessage.
        if (list.some((item) => item.id === action.payload)) {
          state.byChat[action.meta.arg.chatId] = list.filter((item) => item.id !== pendingId);
          return;
        }
        const message = list.find((item) => item.id === pendingId);
        if (message) {
          message.id = action.payload;
          message.status = nextStatus(message.status, 'sent');
          applyEarlyStatus(state, message);
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        const message = state.byChat[action.meta.arg.chatId]?.find(
          (item) => item.id === localId(action.meta.requestId),
        );
        if (message) {
          message.status = 'failed';
          message.error = action.payload ?? action.error.message;
        }
      })
      .addCase(fetchHistory.pending, (state, action) => {
        state.historyStatus[action.meta.arg] = 'loading';
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.historyStatus[action.meta.arg] = 'loaded';
        state.byChat[action.meta.arg] ??= [];
        action.payload.forEach((message) => upsertMessage(state, message));
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.historyStatus[action.meta.arg] = 'failed';
      })
      .addCase(fetchRecentMessages.pending, (state) => {
        state.recentStatus = 'loading';
      })
      .addCase(fetchRecentMessages.fulfilled, (state, action) => {
        state.recentStatus = 'loaded';
        action.payload.messages.forEach((message) => upsertMessage(state, message));
      })
      .addCase(fetchRecentMessages.rejected, (state) => {
        state.recentStatus = 'failed';
      });
  },
});

export const { messageReceived, messageStatusChanged, messageRemoved } = messagesSlice.actions;
export const messagesReducer = messagesSlice.reducer;

const EMPTY_MESSAGES: Message[] = [];

export const selectChatMessages = (state: RootState, chatId: string) =>
  state.messages.byChat[chatId] ?? EMPTY_MESSAGES;

export const selectLastMessage = (state: RootState, chatId: string): Message | undefined => {
  const list = state.messages.byChat[chatId];
  return list?.[list.length - 1];
};

export const selectHistoryStatus = (state: RootState, chatId: string) => state.messages.historyStatus[chatId];

export const selectRecentStatus = (state: RootState) => state.messages.recentStatus;

export const selectHasMessage = (state: RootState, chatId: string, id: string) =>
  state.messages.byChat[chatId]?.some((item) => item.id === id) ?? false;
