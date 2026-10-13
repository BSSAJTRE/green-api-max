import { useLayoutEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAppDispatch } from '../../app/hooks';
import { ArrowUpIcon } from '../../components/icons';
import { CHAT_COLUMN_MAX_WIDTH_PX, CHAT_SIDE_PADDING_PX } from './layout';
import { sendMessage } from './messagesSlice';

/** Ограничение SendMessage на длину текста. */
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TEXTAREA_HEIGHT_PX = 160;

export function MessageInput({ chatId }: { chatId: string }) {
  const dispatch = useAppDispatch();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [text]);

  const submit = () => {
    if (!canSend) return;
    void dispatch(sendMessage({ chatId, text: trimmed }));
    setText('');
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Field>
        <TextArea
          ref={textareaRef}
          rows={1}
          placeholder="Сообщение"
          aria-label="Текст сообщения"
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        {canSend && (
          <SendButton
            type="submit"
            title="Отправить (Enter)"
            onMouseDown={(event) => event.preventDefault()}
          >
            <ArrowUpIcon size={20} strokeWidth={2.4} />
          </SendButton>
        )}
      </Field>
    </Form>
  );
}

const FIELD_HEIGHT_PX = 46;
const SEND_BUTTON_SIZE_PX = 34;
const SEND_BUTTON_INSET_PX = (FIELD_HEIGHT_PX - SEND_BUTTON_SIZE_PX) / 2;

const Form = styled.form`
  width: 100%;
  max-width: ${CHAT_COLUMN_MAX_WIDTH_PX + 2 * CHAT_SIDE_PADDING_PX}px;
  margin: 0 auto;
  padding: 12px ${CHAT_SIDE_PADDING_PX}px 16px;
`;

const Field = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-height: ${FIELD_HEIGHT_PX}px;
  padding-right: ${SEND_BUTTON_INSET_PX}px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadows.bubble};
`;

const TextArea = styled.textarea`
  flex: 1;
  min-width: 0;
  height: ${FIELD_HEIGHT_PX}px;
  padding: 13px 0 13px 18px;
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  line-height: 20px;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const appear = keyframes`
  from {
    opacity: 0;
    transform: scale(0.5);
  }
`;

const SendButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${SEND_BUTTON_SIZE_PX}px;
  height: ${SEND_BUTTON_SIZE_PX}px;
  margin-bottom: ${SEND_BUTTON_INSET_PX}px;
  border: none;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.textInverse};
  animation: ${appear} 0.15s ease-out;
  transition:
    background 0.15s,
    transform 0.1s;

  &:hover {
    background: ${({ theme }) => theme.colors.accentHover};
  }

  &:active {
    transform: scale(0.92);
  }
`;
