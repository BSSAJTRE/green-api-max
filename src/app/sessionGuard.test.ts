import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { loggedOut } from '../features/auth/authSlice';
import {
  fetchRecentMessages,
  messagesReducer,
  type Message,
  type RecentChat,
} from '../features/messages/messagesSlice';
import { sessionGuard } from './sessionGuard';

const message: Message = {
  id: 'message-1',
  chatId: 'chat-1',
  text: 'Сообщение старого аккаунта',
  timestamp: 100,
  direction: 'incoming',
  status: null,
};

const chat: RecentChat = {
  id: message.chatId,
  name: 'Старый аккаунт',
  lastActivity: message.timestamp,
};

const payload = { chats: [chat], messages: [message] };

function makeStore() {
  return configureStore({
    reducer: { messages: messagesReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sessionGuard),
  });
}

describe('sessionGuard', () => {
  it('drops a fulfilled result that arrives after logout', () => {
    const store = makeStore();
    store.dispatch(fetchRecentMessages.pending('old-request', undefined));

    store.dispatch(loggedOut());
    store.dispatch(fetchRecentMessages.fulfilled(payload, 'old-request', undefined));

    expect(store.getState().messages).toMatchObject({
      byChat: {},
      recentStatus: 'idle',
    });
  });

  it('drops a rejected result that arrives after logout', () => {
    const store = makeStore();
    store.dispatch(fetchRecentMessages.pending('old-request', undefined));

    store.dispatch(loggedOut());
    store.dispatch(
      fetchRecentMessages.rejected(new Error('request failed'), 'old-request', undefined, 'Ошибка запроса'),
    );

    expect(store.getState().messages.recentStatus).toBe('idle');
  });

  it('passes a result from the current session to reducers', () => {
    const store = makeStore();
    store.dispatch(fetchRecentMessages.pending('current-request', undefined));
    store.dispatch(fetchRecentMessages.fulfilled(payload, 'current-request', undefined));

    expect(store.getState().messages.recentStatus).toBe('loaded');
    expect(store.getState().messages.byChat[message.chatId]).toEqual([message]);
  });
});
