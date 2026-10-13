import { useEffect } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { selectActiveChatId } from '../features/chats/chatsSlice';
import { Sidebar } from '../features/chats/Sidebar';
import { ChatWindow } from '../features/messages/ChatWindow';
import { fetchRecentMessages } from '../features/messages/messagesSlice';
import { useNotificationsPolling } from '../features/notifications/useNotificationsPolling';

export function ChatPage() {
  const dispatch = useAppDispatch();
  useNotificationsPolling();
  const hasActiveChat = useAppSelector(selectActiveChatId) !== null;

  useEffect(() => {
    void dispatch(fetchRecentMessages());
  }, [dispatch]);

  return (
    <Layout $hasActiveChat={hasActiveChat}>
      <SidebarArea />
      <ChatArea />
    </Layout>
  );
}

const SidebarArea = styled(Sidebar)``;
const ChatArea = styled(ChatWindow)``;

const Layout = styled.main<{ $hasActiveChat: boolean }>`
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 100%;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;

    ${SidebarArea} {
      display: ${({ $hasActiveChat }) => ($hasActiveChat ? 'none' : 'flex')};
    }

    ${ChatArea} {
      display: ${({ $hasActiveChat }) => ($hasActiveChat ? 'flex' : 'none')};
    }
  }
`;
