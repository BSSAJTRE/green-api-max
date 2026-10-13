import { createSlice } from '@reduxjs/toolkit';
import { getErrorMessage, greenApi } from '../../api/greenApi';
import type { Credentials, InstanceState } from '../../api/types';
import { createAppAsyncThunk } from '../../app/createAppAsyncThunk';
import type { RootState } from '../../app/store';

export interface AuthState {
  credentials: Credentials | null;
  status: 'idle' | 'loading';
  error: string | null;
}

export const authInitialState: AuthState = {
  credentials: null,
  status: 'idle',
  error: null,
};

const INSTANCE_STATE_ERRORS: Record<Exclude<InstanceState, 'authorized' | 'suspended'>, string> = {
  notAuthorized: 'Инстанс не авторизован: отсканируйте QR-код в личном кабинете GREEN-API',
  blocked: 'Аккаунт MAX, привязанный к инстансу, заблокирован',
  starting: 'Инстанс запускается, попробуйте снова через пару минут',
  pendingPassword: 'Завершите авторизацию инстанса: требуется пароль двухфакторной аутентификации',
};

export const login = createAppAsyncThunk('auth/login', async (credentials: Credentials, { rejectWithValue }) => {
  try {
    const { stateInstance } = await greenApi.getStateInstance(credentials);
    if (stateInstance === 'authorized' || stateInstance === 'suspended') return credentials;
    return rejectWithValue(INSTANCE_STATE_ERRORS[stateInstance] ?? `Инстанс в состоянии «${stateInstance}»`);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: authInitialState,
  reducers: {
    loggedOut: () => authInitialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'idle';
        state.credentials = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Не удалось войти';
      });
  },
});

export const { loggedOut } = authSlice.actions;
export const authReducer = authSlice.reducer;

export const selectCredentials = (state: RootState) => state.auth.credentials;
export const selectAuth = (state: RootState) => state.auth;
