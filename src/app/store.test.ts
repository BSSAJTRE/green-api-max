import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Credentials } from '../api/types';
import { loggedOut, login } from '../features/auth/authSlice';
import { connectionEstablished } from '../features/notifications/connectionSlice';

function createLocalStorageMock() {
  const data = new Map<string, string>();
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
  return { data, storage };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('store persistence', () => {
  it('cancels a pending save and removes persisted credentials synchronously on logout', async () => {
    vi.useFakeTimers();
    const { data, storage } = createLocalStorageMock();
    vi.stubGlobal('localStorage', storage);
    const { store } = await import('./store');
    const credentials: Credentials = {
      apiUrl: 'https://api.example.com',
      idInstance: '1',
      apiTokenInstance: 'token',
    };

    store.dispatch(login.pending('login-request', credentials));
    store.dispatch(login.fulfilled(credentials, 'login-request', credentials));
    await vi.advanceTimersByTimeAsync(300);
    expect(data.has('greenapi-max-chat/v1')).toBe(true);

    store.dispatch(connectionEstablished());
    expect(vi.getTimerCount()).toBe(1);

    store.dispatch(loggedOut());

    expect(storage.removeItem).toHaveBeenCalledWith('greenapi-max-chat/v1');
    expect(data.has('greenapi-max-chat/v1')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(300);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
