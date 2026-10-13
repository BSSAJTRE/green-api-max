import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Avatar } from '../../components/Avatar';
import { formatChatListTime } from '../../utils/date';
import { selectLastMessage } from '../messages/messagesSlice';
import { chatSelected, type Chat } from './chatsSlice';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
}

export function ChatListItem({ chat, isActive }: ChatListItemProps) {
  const dispatch = useAppDispatch();
  const lastMessage = useAppSelector((state) => selectLastMessage(state, chat.id));

  const preview = lastMessage
    ? `${lastMessage.direction === 'outgoing' ? 'Вы: ' : ''}${lastMessage.text}`
    : 'Нет сообщений';

  return (
    <Item type="button" $active={isActive} onClick={() => dispatch(chatSelected(chat.id))}>
      <Avatar id={chat.id} name={chat.name} />
      <Body>
        <TopRow>
          <Name>{chat.name}</Name>
          {lastMessage && <Time>{formatChatListTime(lastMessage.timestamp)}</Time>}
        </TopRow>
        <BottomRow>
          <Preview $muted={!lastMessage}>{preview}</Preview>
          {chat.unread > 0 && <Badge>{chat.unread > 99 ? '99+' : chat.unread}</Badge>}
        </BottomRow>
      </Body>
    </Item>
  );
}

const Item = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: ${({ theme, $active }) => ($active ? theme.colors.surfaceActive : 'transparent')};
  text-align: left;
  transition: background 0.15s;

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.surfaceActive : theme.colors.surfaceHover)};
  }
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ellipsis = `
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const Name = styled.span`
  flex: 1;
  font-weight: 600;
  ${ellipsis}
`;

const Time = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Preview = styled.span<{ $muted: boolean }>`
  flex: 1;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-style: ${({ $muted }) => ($muted ? 'italic' : 'normal')};
  ${ellipsis}
`;

const Badge = styled.span`
  flex-shrink: 0;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.textInverse};
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
`;
