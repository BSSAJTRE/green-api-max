import { useEffect, useId, useRef, type ReactNode } from 'react';
import styled from 'styled-components';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Модальное окно на нативном <dialog>: фокус внутри окна, закрытие по Esc и клику по фону. */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal фокусирует первый интерактивный элемент, а React не выставляет атрибут autofocus.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <Dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // Клик по самому <dialog> возможен только по затемнённому фону: содержимое занимает его целиком.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <Content>
          <Title id={titleId}>{title}</Title>
          {children}
        </Content>
      )}
    </Dialog>
  );
}

const Dialog = styled.dialog`
  width: min(400px, calc(100vw - 32px));
  padding: 0;
  overflow: visible;
  border: none;
  border-radius: 28px;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  box-shadow: ${({ theme }) => theme.shadows.card};

  &::backdrop {
    background: rgba(26, 28, 34, 0.4);
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 26px;
`;
