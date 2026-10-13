import { useAppSelector } from './app/hooks';
import { selectCredentials } from './features/auth/authSlice';
import { ChatPage } from './pages/ChatPage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  const credentials = useAppSelector(selectCredentials);
  return credentials ? <ChatPage /> : <LoginPage />;
}
