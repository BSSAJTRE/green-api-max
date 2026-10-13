import { createEntityAdapter, createSlice, type EntityState, type PayloadAction } from '@reduxjs/toolkit';
import { getErrorMessage, greenApi } from '../../api/greenApi';
import { createAppAsyncThunk } from '../../app/createAppAsyncThunk';
import type { RootState } from '../../app/store';
import { formatPhone, isSupportedPhone, normalizePhone } from '../../utils/phone';
import { loggedOut, selectCredentials } from '../auth/authSlice';
import { fetchRecentMessages, messageReceived, sendMessage } from '../messages/messagesSlice';

export interface Chat {
  /** chatId в MAX — внутренний идентификатор пользователя, а не номер телефона. */
  id: string;
  name: string;
  phone: string | null;
  unread: number;
  /** Время последней активности в миллисекундах, по нему сортируется список. */
  lastActivity: number;
}

export const chatsAdapter = createEntityAdapter<Chat>({
  sortComparer: (a, b) => b.lastActivity - a.lastActivity,
});

export interface ChatsState extends EntityState<Chat, string> {
  activeChatId: string | null;
  createStatus: 'idle' | 'loading';
  createError: string | null;
}

export const chatsInitialState: ChatsState = chatsAdapter.getInitialState({
  activeChatId: null,
  createStatus: 'idle',
  createError: null,
});

/** Имя ещё не известно: вместо него показывается номер телефона или chatId. */
const hasPlaceholderName = (chat: Chat) =>
  chat.name === chat.id || (chat.phone !== null && chat.name === formatPhone(chat.phone));

const CHECK_ACCOUNT_REASONS: Record<string, string> = {
  'instance is starting or not authorized': 'Инстанс запускается или не авторизован',
  'User get contact info limit reached': 'MAX ограничил проверку номеров. Попробуйте позже',
};

export const createChat = createAppAsyncThunk(
  'chats/create',
  async (rawPhone: string, { getState, rejectWithValue }) => {
    const phone = normalizePhone(rawPhone);
    if (!isSupportedPhone(phone)) {
      return rejectWithValue('Введите номер полностью: MAX поддерживает номера РФ (+7) и РБ (+375)');
    }

    const existing = selectAllChats(getState()).find((chat) => chat.phone === phone);
    if (existing) return { chatId: existing.id, phone };

    const credentials = selectCredentials(getState());
    if (!credentials) return rejectWithValue('Требуется авторизация');

    try {
      const result = await greenApi.checkAccount(credentials, phone);
      if ('reason' in result) {
        return rejectWithValue(CHECK_ACCOUNT_REASONS[result.reason] ?? result.reason);
      }
      if (!result.exist || !result.chatId) return rejectWithValue('У этого номера нет аккаунта MAX');
      return { chatId: result.chatId, phone };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

const chatsSlice = createSlice({
  name: 'chats',
  initialState: chatsInitialState,
  reducers: {
    chatSelected: (state, action: PayloadAction<string | null>) => {
      state.activeChatId = action.payload;
      if (action.payload) chatsAdapter.updateOne(state, { id: action.payload, changes: { unread: 0 } });
    },
    createErrorCleared: (state) => {
      state.createError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loggedOut, () => chatsInitialState)
      .addCase(createChat.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createChat.fulfilled, (state, action) => {
        const { chatId, phone } = action.payload;
        state.createStatus = 'idle';
        state.activeChatId = chatId;

        const existing = state.entities[chatId];
        if (existing) {
          chatsAdapter.updateOne(state, { id: chatId, changes: { phone: existing.phone ?? phone, unread: 0 } });
        } else {
          chatsAdapter.addOne(state, {
            id: chatId,
            name: formatPhone(phone),
            phone,
            unread: 0,
            lastActivity: Date.now(),
          });
        }
      })
      .addCase(createChat.rejected, (state, action) => {
        state.createStatus = 'idle';
        state.createError = action.payload ?? 'Не удалось создать чат';
      })
      .addCase(sendMessage.pending, (state, action) => {
        chatsAdapter.updateOne(state, { id: action.meta.arg.chatId, changes: { lastActivity: Date.now() } });
      })
      .addCase(messageReceived, (state, action) => {
        const { chat, message } = action.payload;
        const isUnread = message.direction === 'incoming' && state.activeChatId !== chat.id;
        const existing = state.entities[chat.id];

        if (!existing) {
          chatsAdapter.addOne(state, {
            id: chat.id,
            name: chat.name,
            phone: chat.phone,
            unread: isUnread ? 1 : 0,
            lastActivity: message.timestamp,
          });
          return;
        }

        chatsAdapter.updateOne(state, {
          id: chat.id,
          changes: {
            name: hasPlaceholderName(existing) && chat.name ? chat.name : existing.name,
            phone: existing.phone ?? chat.phone,
            unread: existing.unread + (isUnread ? 1 : 0),
            lastActivity: Math.max(existing.lastActivity, message.timestamp),
          },
        });
      })
      .addCase(fetchRecentMessages.fulfilled, (state, action) => {
        for (const { id, name, lastActivity } of action.payload.chats) {
          const existing = state.entities[id];
          if (!existing) {
            chatsAdapter.addOne(state, { id, name: name ?? id, phone: null, unread: 0, lastActivity });
            continue;
          }
          chatsAdapter.updateOne(state, {
            id,
            changes: {
              name: hasPlaceholderName(existing) && name ? name : existing.name,
              lastActivity: Math.max(existing.lastActivity, lastActivity),
            },
          });
        }
      });
  },
});

export const { chatSelected, createErrorCleared } = chatsSlice.actions;
export const chatsReducer = chatsSlice.reducer;

export const { selectAll: selectAllChats, selectById: selectChatById } = chatsAdapter.getSelectors(
  (state: RootState) => state.chats,
);

export const selectActiveChatId = (state: RootState) => state.chats.activeChatId;

export const selectActiveChat = (state: RootState) =>
  state.chats.activeChatId ? selectChatById(state, state.chats.activeChatId) : undefined;

export const selectCreateChatStatus = (state: RootState) => state.chats.createStatus;
export const selectCreateChatError = (state: RootState) => state.chats.createError;
