import type { RootState } from './store';
import { persistedStateSchema, type PersistedState } from './persistSchema';

const STORAGE_KEY = 'greenapi-max-chat/v1';
const MESSAGES_PER_CHAT_LIMIT = 200;

export type { PersistedState } from './persistSchema';

function removePersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage недоступен
  }
}

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    const result = persistedStateSchema.safeParse(data);
    if (!result.success) {
      // Не логируем содержимое: в нём находится apiTokenInstance.
      console.error('Некорректные данные сохранённой сессии', result.error.issues);
      removePersistedState();
      return null;
    }
    const state = result.data;

    // Отправка, прерванная перезагрузкой страницы, уже не завершится.
    for (const list of Object.values(state.messages)) {
      for (const message of list) {
        if (message.status === 'pending') message.status = 'failed';
      }
    }
    return state;
  } catch {
    removePersistedState();
    return null;
  }
}

export function savePersistedState(state: RootState) {
  const { credentials } = state.auth;
  if (!credentials) {
    removePersistedState();
    return;
  }

  const messages = Object.fromEntries(
    Object.entries(state.messages.byChat).map(([chatId, list]) => [chatId, list.slice(-MESSAGES_PER_CHAT_LIMIT)]),
  );
  const persisted: PersistedState = {
    credentials,
    chats: Object.values(state.chats.entities),
    activeChatId: state.chats.activeChatId,
    messages,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // localStorage переполнен или недоступен — работаем без сохранения
  }
}
