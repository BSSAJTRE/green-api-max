import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPersistedState } from './persist';

const STORAGE_KEY = 'greenapi-max-chat/v1';

function createLocalStorageMock(initialValue?: string) {
  const data = new Map<string, string>();
  if (initialValue !== undefined) data.set(STORAGE_KEY, initialValue);

  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: vi.fn(() => data.clear()),
    getItem: vi.fn((key) => data.get(key) ?? null),
    key: vi.fn((index) => [...data.keys()][index] ?? null),
    removeItem: vi.fn((key) => data.delete(key)),
    setItem: vi.fn((key, value) => data.set(key, value)),
  };
  vi.stubGlobal('localStorage', storage);
  return { data, storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadPersistedState', () => {
  it('returns validated state, strips unknown fields and fails interrupted sends', () => {
    const rawState = {
      credentials: {
        apiUrl: 'https://api.example.com',
        idInstance: '1',
        apiTokenInstance: 'token',
        unknownCredentialField: true,
      },
      chats: [
        {
          id: 'chat-1',
          name: 'Анна',
          phone: '79991112233',
          unread: 1,
          lastActivity: 100,
          unknownChatField: true,
        },
      ],
      activeChatId: 'chat-1',
      messages: {
        'chat-1': [
          {
            id: 'local:request-1',
            chatId: 'chat-1',
            text: 'Привет',
            timestamp: 100,
            direction: 'outgoing',
            status: 'pending',
            unknownMessageField: true,
          },
        ],
      },
      unknownRootField: true,
    };
    createLocalStorageMock(JSON.stringify(rawState));

    expect(loadPersistedState()).toEqual({
      credentials: {
        apiUrl: 'https://api.example.com',
        idInstance: '1',
        apiTokenInstance: 'token',
      },
      chats: [
        {
          id: 'chat-1',
          name: 'Анна',
          phone: '79991112233',
          unread: 1,
          lastActivity: 100,
        },
      ],
      activeChatId: 'chat-1',
      messages: {
        'chat-1': [
          {
            id: 'local:request-1',
            chatId: 'chat-1',
            text: 'Привет',
            timestamp: 100,
            direction: 'outgoing',
            status: 'failed',
          },
        ],
      },
    });
  });

  it('removes a stored session with an invalid structure', () => {
    const { data, storage } = createLocalStorageMock(
      JSON.stringify({
        credentials: { apiUrl: 'https://api.example.com', idInstance: '1' },
        chats: [],
        activeChatId: null,
        messages: {},
      }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(loadPersistedState()).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(data.has(STORAGE_KEY)).toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('removes a stored session containing malformed JSON', () => {
    const { data, storage } = createLocalStorageMock('{not-json');

    expect(loadPersistedState()).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(data.has(STORAGE_KEY)).toBe(false);
  });
});
