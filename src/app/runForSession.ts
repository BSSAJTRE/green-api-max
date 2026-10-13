import type { Credentials } from '../api/types';
import { selectCredentials } from '../features/auth/authSlice';
import type { AppThunk } from './store';

/**
 * Выполняет операцию только в той сессии, в которой она была запущена.
 *
 * Сравнение по ссылке намеренно: после выхода и повторного входа даже с теми же
 * реквизитами создаётся новая сессия, поэтому callback старого polling-цикла
 * не должен менять состояние нового.
 */
export const runForSession =
  <ReturnType>(credentials: Credentials, operation: AppThunk<ReturnType>): AppThunk<ReturnType | undefined> =>
  (dispatch, getState, extraArgument) => {
    if (selectCredentials(getState()) !== credentials) return undefined;
    return operation(dispatch, getState, extraArgument);
  };
