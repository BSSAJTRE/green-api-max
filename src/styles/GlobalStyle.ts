import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }

  body {
    font-family: ${({ theme }) => theme.font.family};
    font-size: 15px;
    line-height: 1.4;
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.background};
    -webkit-font-smoothing: antialiased;
  }

  button,
  input,
  textarea {
    font: inherit;
    color: inherit;
  }

  button {
    cursor: pointer;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(26, 28, 34, 0.18);
    border-radius: 3px;
  }
`;
