import { memo } from 'react';
import styled from 'styled-components';
import { useAppDispatch } from '../../app/hooks';
import { AlertIcon, CheckIcon, ClockIcon, DoubleCheckIcon } from '../../components/icons';
import { formatTime } from '../../utils/date';
import { messageRemoved, sendMessage, type Message, type MessageStatus } from './messagesSlice';

const STATUS_TITLES: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
};

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'pending':
      return <ClockIcon size={14} />;
    case 'sent':
      return <CheckIcon size={15} />;
    case 'delivered':
    case 'read':
      return <DoubleCheckIcon size={16} />;
    case 'failed':
      return <AlertIcon size={14} />;
  }
}

/** Положение облачка среди подряд идущих сообщений одного отправителя. */
export type GroupPosition = 'single' | 'first' | 'middle' | 'last';

const RADIUS_LARGE = '16px';
const RADIUS_SMALL = '6px';

/**
 * Внутренняя сторона облачка (к центру ленты) всегда скруглена сильно, а на стороне отправителя
 * сильное скругление только у верхнего угла первого и нижнего угла последнего облачка группы.
 */
function bubbleRadius(outgoing: boolean, position: GroupPosition): string {
  if (position === 'single') return RADIUS_LARGE;
  const edgeTop = position === 'first' ? RADIUS_LARGE : RADIUS_SMALL;
  const edgeBottom = position === 'last' ? RADIUS_LARGE : RADIUS_SMALL;
  // Порядок углов: левый-верхний, правый-верхний, правый-нижний, левый-нижний.
  return outgoing
    ? `${RADIUS_LARGE} ${edgeTop} ${edgeBottom} ${RADIUS_LARGE}`
    : `${edgeTop} ${RADIUS_LARGE} ${RADIUS_LARGE} ${edgeBottom}`;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  groupPosition,
}: {
  message: Message;
  groupPosition: GroupPosition;
}) {
  const dispatch = useAppDispatch();
  const outgoing = message.direction === 'outgoing';

  const handleRetry = () => {
    dispatch(messageRemoved({ chatId: message.chatId, id: message.id }));
    void dispatch(sendMessage({ chatId: message.chatId, text: message.text }));
  };

  return (
    <Row $outgoing={outgoing}>
      <Bubble $outgoing={outgoing} $radius={bubbleRadius(outgoing, groupPosition)}>
        <Text>{message.text}</Text>
        <Meta>
          {formatTime(message.timestamp)}
          {message.status && (
            <StatusMark $status={message.status} title={message.error ?? STATUS_TITLES[message.status]}>
              <StatusIcon status={message.status} />
            </StatusMark>
          )}
        </Meta>
      </Bubble>
      {message.status === 'failed' && (
        <FailedNote>
          {message.error ?? 'Сообщение не отправлено'}
          {message.id.startsWith('local:') && (
            <RetryButton type="button" onClick={handleRetry}>
              Повторить
            </RetryButton>
          )}
        </FailedNote>
      )}
    </Row>
  );
});

const Row = styled.div<{ $outgoing: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $outgoing }) => ($outgoing ? 'flex-end' : 'flex-start')};
  gap: 4px;
`;

const Bubble = styled.div<{ $outgoing: boolean; $radius: string }>`
  position: relative;
  max-width: min(560px, 80%);
  padding: 8px 12px 6px;
  border-radius: ${({ $radius }) => $radius};
  background: ${({ theme, $outgoing }) => ($outgoing ? theme.colors.bubbleOutgoing : theme.colors.bubbleIncoming)};
  box-shadow: ${({ theme }) => theme.shadows.bubble};
`;

const Text = styled.p`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const Meta = styled.span`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 2px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const StatusMark = styled.span<{ $status: MessageStatus }>`
  display: inline-flex;
  color: ${({ theme, $status }) =>
    $status === 'read' ? theme.colors.accent : $status === 'failed' ? theme.colors.danger : 'inherit'};
`;

const FailedNote = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.danger};
`;

const RetryButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.accent};
  font-size: 12px;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
`;
