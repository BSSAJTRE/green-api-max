import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { greenApi } from '../../api/greenApi';
import type { Credentials, ReceivedNotification } from '../../api/types';
import { pollNotifications } from './pollNotifications';

vi.mock('../../api/greenApi', () => ({
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Неизвестная ошибка'),
  greenApi: {
    receiveNotification: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

const credentials: Credentials = {
  apiUrl: 'https://api.example.com',
  idInstance: '1',
  apiTokenInstance: 'token',
};

const notification: ReceivedNotification = {
  receiptId: 42,
  body: { typeWebhook: 'testNotification' },
};

const receiveNotification = vi.mocked(greenApi.receiveNotification);
const deleteNotification = vi.mocked(greenApi.deleteNotification);

function makeHandlers() {
  return {
    onNotification: vi.fn(),
    onConnected: vi.fn(),
    onError: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteNotification.mockResolvedValue({ result: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('pollNotifications', () => {
  it('processes and deletes a received notification', async () => {
    const controller = new AbortController();
    const handlers = makeHandlers();
    handlers.onNotification.mockImplementation(() => controller.abort());
    receiveNotification.mockResolvedValue(notification);

    await pollNotifications(credentials, controller.signal, handlers);

    expect(handlers.onConnected).toHaveBeenCalledOnce();
    expect(handlers.onNotification).toHaveBeenCalledWith(notification.body);
    expect(deleteNotification).toHaveBeenCalledWith(credentials, notification.receiptId, controller.signal);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('deletes a notification even when its handler throws', async () => {
    const controller = new AbortController();
    const handlers = makeHandlers();
    handlers.onNotification.mockImplementation(() => {
      controller.abort();
      throw new Error('unsupported payload');
    });
    receiveNotification.mockResolvedValue(notification);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await pollNotifications(credentials, controller.signal, handlers);

    expect(deleteNotification).toHaveBeenCalledWith(credentials, notification.receiptId, controller.signal);
    expect(consoleError).toHaveBeenCalledOnce();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('stops a pending receive request when the signal is aborted', async () => {
    const controller = new AbortController();
    const handlers = makeHandlers();
    receiveNotification.mockImplementation(
      (_, __, signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );

    const polling = pollNotifications(credentials, controller.signal, handlers);
    await vi.waitFor(() => expect(receiveNotification).toHaveBeenCalledOnce());
    controller.abort();
    await polling;

    expect(deleteNotification).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('uses the long timeout after the connection probe succeeds', async () => {
    const controller = new AbortController();
    const handlers = makeHandlers();
    receiveNotification
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        controller.abort();
        return null;
      });

    await pollNotifications(credentials, controller.signal, handlers);

    expect(receiveNotification.mock.calls.map(([, timeout]) => timeout)).toEqual([5, 20]);
    expect(handlers.onConnected).toHaveBeenCalledTimes(2);
  });

  it('reports a network error and retries with the probe timeout', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const handlers = makeHandlers();
    receiveNotification
      .mockRejectedValueOnce(new Error('Сеть недоступна'))
      .mockImplementationOnce(async () => {
        controller.abort();
        return null;
      });

    const polling = pollNotifications(credentials, controller.signal, handlers);
    await vi.advanceTimersByTimeAsync(5000);
    await polling;

    expect(handlers.onError).toHaveBeenCalledWith('Сеть недоступна');
    expect(receiveNotification.mock.calls.map(([, timeout]) => timeout)).toEqual([5, 5]);
    expect(handlers.onConnected).toHaveBeenCalledOnce();
  });
});
