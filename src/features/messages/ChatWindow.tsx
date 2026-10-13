import { Fragment, useEffect } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import chatPatternUrl from '../../assets/chat-pattern.svg';
import { Avatar } from '../../components/Avatar';
import { BackIcon } from '../../components/icons';
import { IconButton } from '../../components/ui';
import { formatPhone } from '../../utils/phone';
import { chatSelected, selectActiveChat } from '../chats/chatsSlice';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { fetchHistory } from './messagesSlice';

export function ChatWindow({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const chat = useAppSelector(selectActiveChat);
  const chatId = chat?.id;

  useEffect(() => {
    if (chatId) void dispatch(fetchHistory(chatId));
  }, [chatId, dispatch]);

  if (!chat) return <Root className={className} />;

  const phone = chat.phone ? formatPhone(chat.phone) : null;

  return (
    <Root className={className}>
      <Header>
        <BackButton type="button" title="К списку чатов" onClick={() => dispatch(chatSelected(null))}>
          <BackIcon size={22} />
        </BackButton>
        <Avatar id={chat.id} name={chat.name} size={40} />
        <HeaderText>
          <ChatName>{chat.name}</ChatName>
          {phone && phone !== chat.name && <ChatSubtitle>{phone}</ChatSubtitle>}
        </HeaderText>
      </Header>
      <Fragment key={chat.id}>
        <MessageList chatId={chat.id} />
        <MessageInput chatId={chat.id} />
      </Fragment>
    </Root>
  );
}

const Root = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background:
    url("${chatPatternUrl}") 0 0 / 280px repeat,
    ${({ theme }) => theme.colors.chatBackground};
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 10px 20px;
  background: ${({ theme }) => theme.colors.surface};
  flex-shrink: 0;
`;

const BackButton = styled(IconButton)`
  margin-left: -8px;
`;

const HeaderText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const ChatName = styled.h2`
  margin: 0;
  overflow: hidden;
  font-size: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ChatSubtitle = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;
