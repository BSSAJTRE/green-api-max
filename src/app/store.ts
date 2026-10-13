import { combineReducers, configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { authInitialState, authReducer } from '../features/auth/authSlice';
import { chatsAdapter, chatsInitialState, chatsReducer } from '../features/chats/chatsSlice';
import { messagesInitialState, messagesReducer } from '../features/messages/messagesSlice';
import { connectionReducer } from '../features/notifications/connectionSlice';
import { loadPersistedState, savePersistedState, type PersistedState } from './persist';
import { sessionGuard } from './sessionGuard';

const rootReducer = combineReducers({
  auth: authReducer,
  chats: chatsReducer,
  messages: messagesReducer,
  connection: connectionReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

function buildPreloadedState(persisted: PersistedState | null): Partial<RootState> | undefined {
  if (!persisted) return undefined;
  return {
    auth: { ...authInitialState, credentials: persisted.credentials },
    chats: chatsAdapter.setAll({ ...chatsInitialState, activeChatId: persisted.activeChatId }, persisted.chats ?? []),
    messages: { ...messagesInitialState, byChat: persisted.messages ?? {} },
  };
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sessionGuard),
  preloadedState: buildPreloadedState(loadPersistedState()),
});

const SAVE_DELAY_MS = 300;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let previousCredentials = store.getState().auth.credentials;

store.subscribe(() => {
  const state = store.getState();
  const credentials = state.auth.credentials;
  const hasLoggedOut = previousCredentials !== null && credentials === null;
  previousCredentials = credentials;

  if (hasLoggedOut) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    savePersistedState(state);
    return;
  }

  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    savePersistedState(store.getState());
  }, SAVE_DELAY_MS);
});

export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, UnknownAction>;
