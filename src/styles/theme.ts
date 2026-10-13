export const theme = {
  colors: {
    background: '#f1f3f7',
    surface: '#ffffff',
    surfaceHover: '#f4f6fa',
    surfaceActive: '#e8f0ff',
    border: '#e4e7ee',
    text: '#1a1c22',
    textSecondary: '#7b808c',
    textInverse: '#ffffff',
    accent: '#2f6bff',
    accentHover: '#1f5af0',
    accentSoft: '#e6eeff',
    brandGradient: 'linear-gradient(135deg, #3f8cff 0%, #7a5cff 100%)',
    chatBackground: 'linear-gradient(to bottom left, #80bcff 0%, #95d2dc 100%)',
    chatChip: 'rgba(0, 128, 192, 0.5)',
    bubbleIncoming: '#ffffff',
    bubbleOutgoing: '#d9e6ff',
    danger: '#e5484d',
    dangerSoft: '#fdecec',
    success: '#2fa36b',
    warning: '#e8a317',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '18px',
    round: '50%',
  },
  shadows: {
    card: '0 8px 32px rgba(26, 28, 34, 0.08)',
    bubble: '0 1px 1px rgba(26, 28, 34, 0.06)',
  },
  font: {
    family: "'Inter', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
  },
  breakpoints: {
    mobile: '768px',
  },
} as const;

export type AppTheme = typeof theme;
