import { isFulfilled, isPending, isRejected, type Middleware } from '@reduxjs/toolkit';
import { loggedOut } from '../features/auth/authSlice';

/**
 * Отбрасывает результаты асинхронных thunk-ов, запущенных до выхода из аккаунта.
 * Иначе запрос, завершившийся после выхода, запишет данные прошлого аккаунта в очищенное хранилище.
 */
export const sessionGuard: Middleware = () => {
  let activeRequests = new Set<string>();

  return (next) => (action) => {
    if (loggedOut.match(action)) {
      activeRequests = new Set();
    } else if (isPending(action)) {
      activeRequests.add(action.meta.requestId);
    } else if ((isFulfilled(action) || isRejected(action)) && !activeRequests.delete(action.meta.requestId)) {
      return action;
    }
    return next(action);
  };
};
