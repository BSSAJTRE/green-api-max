import { describe, expect, it } from 'vitest';
import {
  messageReceived,
  messageRemoved,
  messagesReducer,
  messageStatusChanged,
  sendMessage,
  type Message,
} from './messagesSlice';

const CHAT_ID = '10000000';
const CHAT = { id: CHAT_ID, name: 'Анна', phone: '79991112233' };

function makeMessage(id: string, timestamp: number, overrides: Partial<Message> = {}): Message {
  return {
    id,
    chatId: CHAT_ID,
    text: id,
    timestamp,
    direction: 'incoming',
    status: null,
    ...overrides,
  };
}

describe('messagesReducer', () => {
  it('keeps messages ordered by timestamp and ignores duplicate ids', () => {
    let state = messagesReducer(undefined, { type: 'test/init' });

    state = messagesReducer(state, messageReceived({ chat: CHAT, message: makeMessage('third', 300) }));
    state = messagesReducer(state, messageReceived({ chat: CHAT, message: makeMessage('first', 100) }));
    state = messagesReducer(state, messageReceived({ chat: CHAT, message: makeMessage('second', 200) }));
    state = messagesReducer(
      state,
      messageReceived({ chat: CHAT, message: makeMessage('second', 200, { text: 'duplicate' }) }),
    );

    expect(state.byChat[CHAT_ID].map(({ id }) => id)).toEqual(['first', 'second', 'third']);
    expect(state.byChat[CHAT_ID]).toHaveLength(3);
    expect(state.byChat[CHAT_ID][1].text).toBe('second');
  });

  it('never rolls a delivered or read status backwards', () => {
    let state = messagesReducer(undefined, { type: 'test/init' });
    state = messagesReducer(
      state,
      messageReceived({
        chat: CHAT,
        message: makeMessage('message-1', 100, { direction: 'outgoing', status: 'sent' }),
      }),
    );

    state = messagesReducer(
      state,
      messageStatusChanged({ chatId: CHAT_ID, id: 'message-1', status: 'delivered' }),
    );
    state = messagesReducer(state, messageStatusChanged({ chatId: CHAT_ID, id: 'message-1', status: 'sent' }));
    expect(state.byChat[CHAT_ID][0].status).toBe('delivered');

    state = messagesReducer(state, messageStatusChanged({ chatId: CHAT_ID, id: 'message-1', status: 'read' }));
    state = messagesReducer(
      state,
      messageStatusChanged({ chatId: CHAT_ID, id: 'message-1', status: 'failed', error: 'late failure' }),
    );
    expect(state.byChat[CHAT_ID][0].status).toBe('read');
    expect(state.byChat[CHAT_ID][0]).not.toHaveProperty('error');
  });

  it('applies a status that arrives before the SendMessage response', () => {
    const requestId = 'request-1';
    const arg = { chatId: CHAT_ID, text: 'Привет' };
    let state = messagesReducer(undefined, sendMessage.pending(requestId, arg));

    state = messagesReducer(
      state,
      messageStatusChanged({ chatId: CHAT_ID, id: 'server-id', status: 'delivered' }),
    );
    state = messagesReducer(state, sendMessage.fulfilled('server-id', requestId, arg));

    expect(state.byChat[CHAT_ID]).toHaveLength(1);
    expect(state.byChat[CHAT_ID][0]).toMatchObject({ id: 'server-id', status: 'delivered' });
    expect(state.earlyStatuses).toEqual({});
  });

  it('applies a status that arrives before the echo notification', () => {
    let state = messagesReducer(undefined, { type: 'test/init' });
    state = messagesReducer(
      state,
      messageStatusChanged({ chatId: CHAT_ID, id: 'server-id', status: 'read' }),
    );
    state = messagesReducer(
      state,
      messageReceived({
        chat: CHAT,
        message: makeMessage('server-id', 100, { direction: 'outgoing', status: 'sent' }),
      }),
    );

    expect(state.byChat[CHAT_ID][0].status).toBe('read');
    expect(state.earlyStatuses).toEqual({});
  });

  it('reconciles an echo notification that arrives before the SendMessage response', () => {
    const requestId = 'request-2';
    const arg = { chatId: CHAT_ID, text: 'Сообщение' };
    let state = messagesReducer(undefined, sendMessage.pending(requestId, arg));

    state = messagesReducer(
      state,
      messageReceived({
        chat: CHAT,
        message: makeMessage('server-id', 100, {
          text: arg.text,
          direction: 'outgoing',
          status: 'sent',
        }),
      }),
    );
    state = messagesReducer(state, sendMessage.fulfilled('server-id', requestId, arg));

    expect(state.byChat[CHAT_ID]).toEqual([
      expect.objectContaining({ id: 'server-id', text: arg.text, status: 'sent' }),
    ]);
  });

  it('marks a rejected send as failed and allows replacing it with a retry', () => {
    const firstRequestId = 'request-failed';
    const retryRequestId = 'request-retry';
    const arg = { chatId: CHAT_ID, text: 'Повторить' };
    let state = messagesReducer(undefined, sendMessage.pending(firstRequestId, arg));

    state = messagesReducer(
      state,
      sendMessage.rejected(new Error('network'), firstRequestId, arg, 'Нет соединения'),
    );
    expect(state.byChat[CHAT_ID][0]).toMatchObject({
      id: `local:${firstRequestId}`,
      status: 'failed',
      error: 'Нет соединения',
    });

    state = messagesReducer(state, messageRemoved({ chatId: CHAT_ID, id: `local:${firstRequestId}` }));
    state = messagesReducer(state, sendMessage.pending(retryRequestId, arg));

    expect(state.byChat[CHAT_ID]).toEqual([
      expect.objectContaining({ id: `local:${retryRequestId}`, status: 'pending', text: arg.text }),
    ]);
  });

  it('bounds statuses for messages that never arrive', () => {
    let state = messagesReducer(undefined, { type: 'test/init' });

    for (let index = 0; index < 150; index += 1) {
      state = messagesReducer(
        state,
        messageStatusChanged({ chatId: CHAT_ID, id: `missing-${index}`, status: 'read' }),
      );
    }

    expect(Object.keys(state.earlyStatuses)).toHaveLength(100);
  });
});
