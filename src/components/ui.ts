import styled, { keyframes } from 'styled-components';

export const Input = styled.input<{ $invalid?: boolean }>`
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid ${({ theme, $invalid }) => ($invalid ? theme.colors.danger : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.accentSoft};
  }
`;

export const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 20px;
  border: none;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.textInverse};
  font-weight: 600;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.accentHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

export const IconButton = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radii.round};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition:
    background 0.15s,
    color 0.15s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.text};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

export const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.danger};
  font-size: 13px;
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const Spinner = styled.span<{ $size?: number }>`
  display: inline-block;
  width: ${({ $size = 18 }) => $size}px;
  height: ${({ $size = 18 }) => $size}px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;
