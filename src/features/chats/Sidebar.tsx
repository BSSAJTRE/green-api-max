import { useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { LogoutIcon, PlusIcon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { loggedOut } from '../auth/authSlice';
import { fetchRecentMessages, selectRecentStatus } from '../messages/messagesSlice';
import { selectConnection } from '../notifications/connectionSlice';
import { ChatListItem } from './ChatListItem';
import { createErrorCleared, selectActiveChatId, selectAllChats } from './chatsSlice';
import { NewChatForm } from './NewChatForm';

export function Sidebar({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const chats = useAppSelector(selectAllChats);
  const activeChatId = useAppSelector(selectActiveChatId);
  const connection = useAppSelector(selectConnection);
  const recentStatus = useAppSelector(selectRecentStatus);
  const [isNewChatOpen, setNewChatOpen] = useState(false);

  const closeNewChat = () => {
    setNewChatOpen(false);
    dispatch(createErrorCleared());
  };

  const handleLogout = () => {
    if (window.confirm('Выйти? Список чатов и сообщения на этом устройстве будут удалены.')) {
      dispatch(loggedOut());
    }
  };

  return (
    <Root className={className}>
      <Header>
        <Title>Чаты</Title>
        <Actions>
          <NewChatButton type="button" title="Новый чат" onClick={() => setNewChatOpen(true)}>
            <PlusIcon size={20} />
          </NewChatButton>
          <LogoutButton type="button" title="Выйти" onClick={handleLogout}>
            <LogoutIcon size={18} />
          </LogoutButton>
        </Actions>
      </Header>

      {connection.status === 'error' && connection.error && <ErrorBanner>{connection.error}</ErrorBanner>}
      {recentStatus === 'failed' && (
        <ErrorBanner role="alert">
          Не удалось загрузить недавние чаты.{' '}
          <RetryButton type="button" onClick={() => void dispatch(fetchRecentMessages())}>
            Повторить
          </RetryButton>
        </ErrorBanner>
      )}

      <Modal open={isNewChatOpen} title="Найти по номеру" onClose={closeNewChat}>
        <NewChatForm onClose={closeNewChat} />
      </Modal>

      <List>
        {chats.length === 0 ? (
          <EmptyHint>Нажмите «+», чтобы начать переписку по номеру телефона</EmptyHint>
        ) : (
          chats.map((chat) => <ChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} />)
        )}
      </List>
    </Root>
  );
}

const Root = styled.aside`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${({ theme }) => theme.colors.surface};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
`;

const Header = styled.header`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 16px;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HeaderButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition:
    background 0.15s,
    color 0.15s;
`;

const NewChatButton = styled(HeaderButton)`
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.textInverse};

  &:hover {
    background: ${({ theme }) => theme.colors.accentHover};
  }
`;

const LogoutButton = styled(HeaderButton)`
  background: ${({ theme }) => theme.colors.surfaceHover};
  color: ${({ theme }) => theme.colors.textSecondary};

  &:hover {
    background: ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Title = styled.h2`
  margin: 0;
  font-size: 22px;
`;

const ErrorBanner = styled.div`
  margin: 12px 16px 4px;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.dangerSoft};
  color: ${({ theme }) => theme.colors.danger};
  font-size: 13px;
`;

const RetryButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
`;

const List = styled.nav`
  flex: 1;
  overflow-y: auto;
`;

const EmptyHint = styled.p`
  margin: 32px 24px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 14px;
  text-align: center;
`;
