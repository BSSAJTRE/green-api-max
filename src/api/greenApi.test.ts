import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApiError, greenApi } from './greenApi';
import type { Credentials } from './types';

const credentials: Credentials = {
  apiUrl: 'https://api.example.com',
  idInstance: '1',
  apiTokenInstance: 'token',
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('greenApi response validation', () => {
  it('returns validated data and strips unknown response fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ idMessage: 'message-1', internalField: 'ignored' }));

    await expect(greenApi.sendMessage(credentials, 'chat-1', 'Привет')).resolves.toEqual({
      idMessage: 'message-1',
    });
  });

  it('accepts a negative CheckAccount response without chatId', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ exist: false }));

    await expect(greenApi.checkAccount(credentials, '79991112233')).resolves.toEqual({
      exist: false,
      chatId: '',
    });
  });

  it('turns an invalid successful response into a controlled GreenApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messageId: 'wrong-field' }));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(greenApi.sendMessage(credentials, 'chat-1', 'Привет')).rejects.toMatchObject<
      Partial<GreenApiError>
    >({
      name: 'GreenApiError',
      message: 'GREEN-API вернул неожиданный формат ответа',
      status: null,
    });
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0][0]).toContain('sendMessage');
  });

  it('turns malformed JSON into a controlled GreenApiError', async () => {
    fetchMock.mockResolvedValue(new Response('{not-json', { status: 200 }));

    await expect(greenApi.getStateInstance(credentials)).rejects.toMatchObject<Partial<GreenApiError>>({
      name: 'GreenApiError',
      message: 'GREEN-API вернул некорректный JSON',
      status: null,
    });
  });

  it('keeps receiptId when the notification body is unknown or malformed', async () => {
    const body = { typeWebhook: 'incomingMessageReceived' };
    fetchMock.mockResolvedValue(jsonResponse({ receiptId: 42, body }));

    await expect(greenApi.receiveNotification(credentials, 5)).resolves.toEqual({
      receiptId: 42,
      body,
    });
  });

  it('rejects a history response containing a malformed item', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ idMessage: 'missing-required-fields' }]));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(greenApi.getChatHistory(credentials, 'chat-1', 50)).rejects.toThrow(
      'GREEN-API вернул неожиданный формат ответа',
    );
  });
});
