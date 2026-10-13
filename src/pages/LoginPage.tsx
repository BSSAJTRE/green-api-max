import { useState, type SubmitEvent } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { ChatBubblesIcon } from '../components/icons';
import { ErrorText, Input, PrimaryButton, Spinner } from '../components/ui';
import { login, selectAuth } from '../features/auth/authSlice';
import {
  API_TOKEN_INSTANCE_MAX_LENGTH,
  ID_INSTANCE_MAX_LENGTH,
  validateLoginForm,
  type LoginFieldErrors,
  type LoginFormValues,
} from '../features/auth/loginSchema';

const API_URL_OVERRIDE = import.meta.env.VITE_GREEN_API_URL;
const API_URL = API_URL_OVERRIDE || 'https://api.green-api.com';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector(selectAuth);

  const [values, setValues] = useState<LoginFormValues>({ idInstance: '', apiTokenInstance: '' });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const isLoading = status === 'loading';

  const handleChange = (field: keyof LoginFormValues, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setFieldErrors(validateLoginForm(next).errors);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    const { data, errors } = validateLoginForm(values);
    setFieldErrors(errors);
    if (!data) return;

    void dispatch(login({ ...data, apiUrl: API_URL }));
  };

  return (
    <Page>
      <Card as="form" onSubmit={handleSubmit} noValidate>
        <Logo>
          <ChatBubblesIcon size={30} />
        </Logo>
        <Title>Вход в MAX Chat</Title>
        <Subtitle>
          Введите параметры инстанса из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
        </Subtitle>

        {API_URL_OVERRIDE && (
          <EmulatorNotice>
            Запросы идут на {API_URL_OVERRIDE} — подойдут любые idInstance и apiTokenInstance
          </EmulatorNotice>
        )}

        <Field>
          <Label htmlFor="idInstance">idInstance</Label>
          <Input
            id="idInstance"
            inputMode="numeric"
            autoComplete="username"
            placeholder="310000000000"
            maxLength={ID_INSTANCE_MAX_LENGTH}
            value={values.idInstance}
            onChange={(event) => handleChange('idInstance', event.target.value)}
            disabled={isLoading}
            autoFocus
            $invalid={Boolean(fieldErrors.idInstance)}
            aria-invalid={Boolean(fieldErrors.idInstance)}
            aria-describedby={fieldErrors.idInstance ? 'idInstance-error' : undefined}
          />
          {fieldErrors.idInstance && <FieldError id="idInstance-error">{fieldErrors.idInstance}</FieldError>}
        </Field>

        <Field>
          <Label htmlFor="apiTokenInstance">apiTokenInstance</Label>
          <Input
            id="apiTokenInstance"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Токен доступа инстанса"
            maxLength={API_TOKEN_INSTANCE_MAX_LENGTH}
            value={values.apiTokenInstance}
            onChange={(event) => handleChange('apiTokenInstance', event.target.value)}
            disabled={isLoading}
            $invalid={Boolean(fieldErrors.apiTokenInstance)}
            aria-invalid={Boolean(fieldErrors.apiTokenInstance)}
            aria-describedby={fieldErrors.apiTokenInstance ? 'apiTokenInstance-error' : undefined}
          />
          {fieldErrors.apiTokenInstance && (
            <FieldError id="apiTokenInstance-error">{fieldErrors.apiTokenInstance}</FieldError>
          )}
        </Field>

        {error && <ErrorText role="alert">{error}</ErrorText>}

        <PrimaryButton type="submit" disabled={isLoading}>
          {isLoading && <Spinner />}
          {isLoading ? 'Проверяем инстанс…' : 'Войти'}
        </PrimaryButton>

        <Disclaimer>
          Тестовый проект — выполнен в рамках тестового задания GREEN-API и не является официальным клиентом MAX
        </Disclaimer>
      </Card>
    </Page>
  );
}

const Page = styled.main`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 24px;
  background:
    radial-gradient(circle at 15% 20%, rgba(63, 140, 255, 0.16), transparent 45%),
    radial-gradient(circle at 85% 80%, rgba(122, 92, 255, 0.16), transparent 45%),
    ${({ theme }) => theme.colors.background};
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 400px;
  padding: 36px 32px 32px;
  border-radius: 24px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 4px;
  border-radius: 20px;
  background: ${({ theme }) => theme.colors.brandGradient};
  color: ${({ theme }) => theme.colors.textInverse};
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  text-align: center;
`;

const Subtitle = styled.p`
  margin: -8px 0 8px;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmulatorNotice = styled.p`
  margin: 0;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.text};
  font-size: 13px;
`;

const FieldError = styled(ErrorText)`
  font-size: 12px;
`;

const Disclaimer = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
`;
