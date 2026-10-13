import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { loggedOut } from '../auth/authSlice';

export interface ConnectionState {
  status: 'connecting' | 'online' | 'error';
  error: string | null;
}

const initialState: ConnectionState = {
  status: 'connecting',
  error: null,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    connectionEstablished: (state) => {
      state.status = 'online';
      state.error = null;
    },
    connectionFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loggedOut, () => initialState);
  },
});

export const { connectionEstablished, connectionFailed } = connectionSlice.actions;
export const connectionReducer = connectionSlice.reducer;

export const selectConnection = (state: RootState) => state.connection;
