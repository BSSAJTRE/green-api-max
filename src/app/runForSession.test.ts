import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import type { Credentials, MessageNotificationBody } from '../api/types';
import { authReducer, loggedOut, login } from '../features/auth/authSlice';
import { chatsReducer } from '../features/chats/chatsSlice';
import { messagesReducer } from '../features/messages/messagesSlice';
import { connectionReducer } from '../features/notifications/connectionSlice';
import { processNotification } from '../features/notifications/processNotification';
import { runForSession } from './runForSession';

const credentials: Credentials = {
  apiUrl: 'https://api.example.com',
  idInstance: '1',
  apiTokenInstance: 'token',
};

const notification: MessageNotificationBody = {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1_700_000_000,
  idMessage: 'message-1',
  senderData: {
    chatId: 'chat-1',
    chatName: 'Анна',
    chatType: 'user',
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Привет' },
  },
};

function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      chats: chatsReducer,
      messages: messagesReducer,
      connection: connectionReducer,
    },
  });
}

function logIn(store: ReturnType<typeof makeStore>, sessionCredentials: Credentials) {
  store.dispatch(login.fulfilled(sessionCredentials, 'login-request', sessionCredentials));
}

describe('runForSession', () => {
  it('allows a polling callback from the current session', () => {
    const store = makeStore();
    logIn(store, credentials);

    store.dispatch(runForSession(credentials, processNotification(notification)));

    expect(store.getState().messages.byChat[notification.senderData.chatId]).toHaveLength(1);
    expect(store.getState().chats.ids).toEqual([notification.senderData.chatId]);
  });

  it('drops a polling callback that arrives after logout', () => {
    const store = makeStore();
    logIn(store, credentials);
    store.dispatch(loggedOut());

    store.dispatch(runForSession(credentials, processNotification(notification)));

    expect(store.getState().messages.byChat).toEqual({});
    expect(store.getState().chats.ids).toEqual([]);
  });

  it('does not mistake a new login with equal credentials for the old session', () => {
    const store = makeStore();
    const newSessionCredentials = { ...credentials };
    logIn(store, credentials);
    store.dispatch(loggedOut());
    logIn(store, newSessionCredentials);

    store.dispatch(runForSession(credentials, processNotification(notification)));
    expect(store.getState().messages.byChat).toEqual({});

    store.dispatch(runForSession(newSessionCredentials, processNotification(notification)));
    expect(store.getState().messages.byChat[notification.senderData.chatId]).toHaveLength(1);
  });
});
