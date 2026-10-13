import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';
import type { MessageNotificationBody, StatusNotificationBody } from '../../api/types';
import { authReducer } from '../auth/authSlice';
import { chatsReducer } from '../chats/chatsSlice';
import { messagesReducer } from '../messages/messagesSlice';
import { connectionReducer } from './connectionSlice';
import { processNotification } from './processNotification';

const CHAT_ID = '10000000';

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

function makeMessageNotification(
  overrides: Partial<MessageNotificationBody> = {},
): MessageNotificationBody {
  return {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 1_700_000_000,
    idMessage: 'message-1',
    senderData: {
      chatId: CHAT_ID,
      chatName: 'Анна',
      chatType: 'user',
      senderName: 'Анна',
      senderPhoneNumber: 79_991_112_233,
    },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: 'Привет' },
    },
    ...overrides,
  };
}

describe('processNotification', () => {
  it('adds an incoming text message and creates an unread chat', () => {
    const store = makeStore();

    store.dispatch(processNotification(makeMessageNotification()));

    expect(store.getState().messages.byChat[CHAT_ID]).toEqual([
      {
        id: 'message-1',
        chatId: CHAT_ID,
        text: 'Привет',
        timestamp: 1_700_000_000_000,
        direction: 'incoming',
        status: null,
      },
    ]);
    expect(store.getState().chats.entities[CHAT_ID]).toMatchObject({
      id: CHAT_ID,
      name: 'Анна',
      phone: '79991112233',
      unread: 1,
      lastActivity: 1_700_000_000_000,
    });
  });

  it('does not duplicate a repeated notification or unread counter', () => {
    const store = makeStore();
    const notification = makeMessageNotification();

    store.dispatch(processNotification(notification));
    store.dispatch(processNotification(notification));

    expect(store.getState().messages.byChat[CHAT_ID]).toHaveLength(1);
    expect(store.getState().chats.entities[CHAT_ID]?.unread).toBe(1);
  });

  it('extracts extended text from an outgoing notification', () => {
    const store = makeStore();
    const notification = makeMessageNotification({
      typeWebhook: 'outgoingMessageReceived',
      idMessage: 'outgoing-1',
      senderData: { chatId: CHAT_ID, chatName: 'Анна', chatType: 'user' },
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'https://example.com' },
      },
    });

    store.dispatch(processNotification(notification));

    expect(store.getState().messages.byChat[CHAT_ID]).toEqual([
      expect.objectContaining({
        id: 'outgoing-1',
        text: 'https://example.com',
        direction: 'outgoing',
        status: 'sent',
      }),
    ]);
    expect(store.getState().chats.entities[CHAT_ID]?.unread).toBe(0);
  });

  it.each([
    [
      'non-text messages',
      makeMessageNotification({
        messageData: { typeMessage: 'imageMessage' },
      }),
    ],
    [
      'group messages',
      makeMessageNotification({
        senderData: { chatId: '-123', chatName: 'Группа', chatType: 'group' },
      }),
    ],
  ])('ignores %s', (_, notification) => {
    const store = makeStore();

    store.dispatch(processNotification(notification));

    expect(store.getState().messages.byChat).toEqual({});
    expect(store.getState().chats.ids).toEqual([]);
  });

  it('maps API delivery failures to a failed message with a readable error', () => {
    const store = makeStore();
    store.dispatch(
      processNotification(
        makeMessageNotification({
          typeWebhook: 'outgoingAPIMessageReceived',
          idMessage: 'outgoing-1',
        }),
      ),
    );
    const status: StatusNotificationBody = {
      typeWebhook: 'outgoingMessageStatus',
      timestamp: 1_700_000_001,
      idMessage: 'outgoing-1',
      chatId: CHAT_ID,
      status: 'noAccount',
    };

    store.dispatch(processNotification(status));

    expect(store.getState().messages.byChat[CHAT_ID][0]).toMatchObject({
      status: 'failed',
      error: 'У получателя нет аккаунта MAX',
    });
  });

  it('ignores unrelated webhook types', () => {
    const store = makeStore();

    store.dispatch(processNotification({ typeWebhook: 'stateInstanceChanged', timestamp: 1_700_000_000 }));

    expect(store.getState().messages.byChat).toEqual({});
    expect(store.getState().chats.ids).toEqual([]);
  });

  it('safely ignores a known webhook with an invalid structure', () => {
    const store = makeStore();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    store.dispatch(processNotification({ typeWebhook: 'incomingMessageReceived' }));

    expect(store.getState().messages.byChat).toEqual({});
    expect(store.getState().chats.ids).toEqual([]);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
