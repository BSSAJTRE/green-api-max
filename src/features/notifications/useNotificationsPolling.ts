import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { runForSession } from '../../app/runForSession';
import { selectCredentials } from '../auth/authSlice';
import { connectionEstablished, connectionFailed } from './connectionSlice';
import { pollNotifications } from './pollNotifications';
import { processNotification } from './processNotification';

export function useNotificationsPolling() {
  const dispatch = useAppDispatch();
  const credentials = useAppSelector(selectCredentials);

  useEffect(() => {
    if (!credentials) return;

    const controller = new AbortController();
    void pollNotifications(credentials, controller.signal, {
      onNotification: (body) => dispatch(runForSession(credentials, processNotification(body))),
      onConnected: () =>
        dispatch(
          runForSession(credentials, (currentDispatch) => currentDispatch(connectionEstablished())),
        ),
      onError: (message) =>
        dispatch(
          runForSession(credentials, (currentDispatch) => currentDispatch(connectionFailed(message))),
        ),
    });

    return () => controller.abort();
  }, [credentials, dispatch]);
}
