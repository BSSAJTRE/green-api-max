import type { ZodType } from 'zod';
import {
  checkAccountResponseSchema,
  deleteNotificationResponseSchema,
  getStateInstanceResponseSchema,
  historyMessagesSchema,
  receiveNotificationResponseSchema,
  sendMessageResponseSchema,
} from './schemas';
import type { Credentials } from './types';

export class GreenApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
  }
}

interface RequestOptions {
  httpMethod?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  pathSuffix?: string;
  query?: Record<string, string | number>;
  signal?: AbortSignal;
}

function buildUrl(credentials: Credentials, method: string, options: RequestOptions): string {
  const base = credentials.apiUrl.trim().replace(/\/+$/, '');
  const suffix = options.pathSuffix ? `/${options.pathSuffix}` : '';
  const url = `${base}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${suffix}`;

  if (!options.query) return url;
  const params = new URLSearchParams(
    Object.entries(options.query).map(([key, value]) => [key, String(value)]),
  );
  return `${url}?${params}`;
}

function describeHttpError(status: number, rawText: string): string {
  if (status === 401) return 'Неверный idInstance или apiTokenInstance';
  if (status === 403) return 'Доступ запрещён: проверьте тариф и состояние инстанса';
  if (status === 429) return 'Слишком много запросов, попробуйте чуть позже';
  if (/webhook url/i.test(rawText)) {
    return 'У инстанса задан webhookUrl. Очистите его в личном кабинете GREEN-API, чтобы получать сообщения через HTTP API';
  }
  if (status >= 500) return `Сервер GREEN-API недоступен (${status})`;

  try {
    const data: unknown = JSON.parse(rawText);
    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string' &&
      data.message
    ) {
      return data.message;
    }
  } catch {
    // тело ответа не JSON
  }
  return rawText.trim() || `Ошибка запроса (${status})`;
}

async function request<T>(
  credentials: Credentials,
  method: string,
  responseSchema: ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { httpMethod = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(credentials, method, options), {
      method: httpMethod,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new GreenApiError('Не удалось подключиться к GREEN-API. Проверьте интернет-соединение');
  }

  const text = await response.text();
  if (!response.ok) {
    throw new GreenApiError(describeHttpError(response.status, text), response.status);
  }

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new GreenApiError('GREEN-API вернул некорректный JSON');
  }

  const result = responseSchema.safeParse(data);
  if (!result.success) {
    // Не логируем тело ответа: оно может содержать сообщения и другие пользовательские данные.
    console.error(`Некорректный ответ метода GREEN-API ${method}`, result.error.issues);
    throw new GreenApiError('GREEN-API вернул неожиданный формат ответа');
  }
  return result.data;
}

export const greenApi = {
  getStateInstance(credentials: Credentials) {
    return request(credentials, 'getStateInstance', getStateInstanceResponseSchema);
  },

  checkAccount(credentials: Credentials, phoneNumber: string) {
    return request(credentials, 'checkAccount', checkAccountResponseSchema, {
      httpMethod: 'POST',
      body: { phoneNumber: Number(phoneNumber) },
    });
  },

  sendMessage(credentials: Credentials, chatId: string, message: string) {
    return request(credentials, 'sendMessage', sendMessageResponseSchema, {
      httpMethod: 'POST',
      body: { chatId, message },
    });
  },

  getChatHistory(credentials: Credentials, chatId: string, count: number) {
    return request(credentials, 'getChatHistory', historyMessagesSchema, {
      httpMethod: 'POST',
      body: { chatId, count },
    });
  },

  lastIncomingMessages(credentials: Credentials, minutes: number) {
    return request(credentials, 'lastIncomingMessages', historyMessagesSchema, { query: { minutes } });
  },

  lastOutgoingMessages(credentials: Credentials, minutes: number) {
    return request(credentials, 'lastOutgoingMessages', historyMessagesSchema, { query: { minutes } });
  },

  receiveNotification(credentials: Credentials, receiveTimeoutSec: number, signal?: AbortSignal) {
    return request(credentials, 'receiveNotification', receiveNotificationResponseSchema, {
      query: { receiveTimeout: receiveTimeoutSec },
      signal,
    });
  },

  deleteNotification(credentials: Credentials, receiptId: number, signal?: AbortSignal) {
    return request(credentials, 'deleteNotification', deleteNotificationResponseSchema, {
      httpMethod: 'DELETE',
      pathSuffix: String(receiptId),
      signal,
    });
  },
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка';
}
