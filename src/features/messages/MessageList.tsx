import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ChevronDownIcon } from '../../components/icons';
import { Spinner } from '../../components/ui';
import { formatDayDivider, isSameDay } from '../../utils/date';
import { CHAT_COLUMN_MAX_WIDTH_PX, CHAT_SIDE_PADDING_PX } from './layout';
import { MessageBubble, type GroupPosition } from './MessageBubble';
import { fetchHistory, selectChatMessages, selectHistoryStatus, type Message } from './messagesSlice';

/** Если пользователь пролистал выше этого порога, новые сообщения не прокручивают ленту. */
const STICK_TO_BOTTOM_THRESHOLD_PX = 120;

/** Сообщения в одной группе, если они подряд от одного отправителя и их не разделяет смена дня. */
function isSameGroup(a: Message | undefined, b: Message | undefined): boolean {
  return Boolean(a && b && a.direction === b.direction && isSameDay(a.timestamp, b.timestamp));
}

function getGroupPosition(previous: Message | undefined, message: Message, next: Message | undefined): GroupPosition {
  const continuesGroup = isSameGroup(previous, message);
  const groupContinues = isSameGroup(message, next);
  if (continuesGroup && groupContinues) return 'middle';
  if (continuesGroup) return 'last';
  if (groupContinues) return 'first';
  return 'single';
}

export function MessageList({ chatId }: { chatId: string }) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => selectChatMessages(state, chatId));
  const historyStatus = useAppSelector((state) => selectHistoryStatus(state, chatId));

  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [isScrolledUp, setScrolledUp] = useState(false);
  const lastMessage = messages[messages.length - 1];

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (stickToBottomRef.current || lastMessage?.direction === 'outgoing') {
      container.scrollTop = container.scrollHeight;
    }
  }, [chatId, messages.length, lastMessage]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceToBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
    setScrolledUp(!stickToBottomRef.current);
  };

  const scrollToBottom = () => {
    const container = containerRef.current;
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  };

  return (
    <Root>
      <Container ref={containerRef} onScroll={handleScroll}>
        <Feed>
          {historyStatus === 'loading' && (
            <Notice>
              <Spinner $size={14} /> Загружаем историю…
            </Notice>
          )}
          {historyStatus === 'failed' && (
            <Notice role="alert">
              Не удалось загрузить историю
              <RetryButton type="button" onClick={() => void dispatch(fetchHistory(chatId))}>
                Повторить
              </RetryButton>
            </Notice>
          )}
          {messages.length === 0 && historyStatus === 'loaded' && <Notice>Сообщений пока нет. Напишите первым!</Notice>}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDivider = !previous || !isSameDay(previous.timestamp, message.timestamp);
            return (
              <Fragment key={message.id}>
                {showDivider && (
                  <DayDivider>
                    <span>{formatDayDivider(message.timestamp)}</span>
                  </DayDivider>
                )}
                <MessageBubble
                  message={message}
                  groupPosition={getGroupPosition(previous, message, messages[index + 1])}
                />
              </Fragment>
            );
          })}
        </Feed>
      </Container>

      {isScrolledUp && (
        <ScrollButtonLayer>
          <ScrollDownButton type="button" title="К новым сообщениям" onClick={scrollToBottom}>
            <ChevronDownIcon size={24} />
          </ScrollDownButton>
        </ScrollButtonLayer>
      )}
    </Root>
  );
}

const Root = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Container = styled.div`
  flex: 1;
  overflow-y: auto;
  /* Резерв под полосу прокрутки с обеих сторон, чтобы колонка сообщений не смещалась относительно поля ввода. */
  scrollbar-gutter: stable both-edges;
  padding: 16px ${CHAT_SIDE_PADDING_PX}px;
`;

const Feed = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 6px;
  min-height: 100%;
  max-width: ${CHAT_COLUMN_MAX_WIDTH_PX}px;
  margin: 0 auto;
`;

/** Повторяет ширину колонки сообщений, чтобы кнопка стояла у её правого края. */
const ScrollButtonLayer = styled.div`
  position: absolute;
  right: ${CHAT_SIDE_PADDING_PX}px;
  bottom: 16px;
  left: ${CHAT_SIDE_PADDING_PX}px;
  display: flex;
  justify-content: flex-end;
  max-width: ${CHAT_COLUMN_MAX_WIDTH_PX}px;
  margin: 0 auto;
  pointer-events: none;
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
`;

const ScrollDownButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textSecondary};
  box-shadow: 0 2px 12px rgba(26, 28, 34, 0.16);
  pointer-events: auto;
  animation: ${fadeIn} 0.15s ease-out;
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Notice = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  align-self: center;
  margin: auto 0;
  padding: 8px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 14px;
`;

const RetryButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
`;

const DayDivider = styled.div`
  display: flex;
  justify-content: center;
  margin: 10px 0 4px;

  span {
    padding: 4px 12px;
    border-radius: 12px;
    background: ${({ theme }) => theme.colors.chatChip};
    color: ${({ theme }) => theme.colors.textInverse};
    font-size: 12px;
    font-weight: 500;
  }
`;
