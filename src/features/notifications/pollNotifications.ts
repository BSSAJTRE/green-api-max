import { getErrorMessage, greenApi } from '../../api/greenApi';
import type { Credentials } from '../../api/types';

/** Сколько секунд сервер держит запрос ReceiveNotification открытым (допустимо 5–60). */
const RECEIVE_TIMEOUT_SEC = 20;
/** Короткий таймаут после старта и ошибок, чтобы быстрее подтвердить соединение. */
const PROBE_TIMEOUT_SEC = 5;
const RETRY_DELAY_MS = 5000;

interface PollHandlers {
  onNotification: (body: unknown) => void;
  onConnected: () => void;
  onError: (message: string) => void;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Бесконечный цикл получения уведомлений через HTTP API:
 * ReceiveNotification → обработка → DeleteNotification.
 * Останавливается при отмене signal.
 */
export async function pollNotifications(credentials: Credentials, signal: AbortSignal, handlers: PollHandlers) {
  let timeoutSec = PROBE_TIMEOUT_SEC;

  while (!signal.aborted) {
    try {
      const notification = await greenApi.receiveNotification(credentials, timeoutSec, signal);
      timeoutSec = RECEIVE_TIMEOUT_SEC;
      handlers.onConnected();
      if (!notification) continue;

      try {
        handlers.onNotification(notification.body);
      } catch (error) {
        console.error('Не удалось обработать уведомление', notification, error);
      }
      // Удаляем даже необработанные уведомления, иначе очередь застрянет на них.
      await greenApi.deleteNotification(credentials, notification.receiptId, signal);
    } catch (error) {
      if (signal.aborted) return;
      timeoutSec = PROBE_TIMEOUT_SEC;
      handlers.onError(getErrorMessage(error));
      await delay(RETRY_DELAY_MS, signal);
    }
  }
}
