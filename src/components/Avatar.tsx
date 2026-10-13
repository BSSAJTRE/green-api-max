import styled from 'styled-components';

const PALETTE = [
  'linear-gradient(135deg, #ff8a65, #ff5370)',
  'linear-gradient(135deg, #ffca57, #ff8f3f)',
  'linear-gradient(135deg, #5ee0a0, #20b486)',
  'linear-gradient(135deg, #5ec8ff, #2f8bff)',
  'linear-gradient(135deg, #9b8cff, #6a5cff)',
  'linear-gradient(135deg, #ff8ad8, #d75cff)',
];

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function getInitials(name: string): string {
  if (/^\+?\d/.test(name.trim())) return name.replace(/\D/g, '').slice(-2);
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '#';
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

const Circle = styled.div<{ $size: number; $background: string }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ theme }) => theme.radii.round};
  background: ${({ $background }) => $background};
  color: ${({ theme }) => theme.colors.textInverse};
  font-size: ${({ $size }) => Math.round($size * 0.36)}px;
  font-weight: 600;
  user-select: none;
`;

interface AvatarProps {
  id: string;
  name: string;
  size?: number;
}

export function Avatar({ id, name, size = 48 }: AvatarProps) {
  return (
    <Circle $size={size} $background={PALETTE[hashString(id) % PALETTE.length]}>
      {getInitials(name)}
    </Circle>
  );
}
