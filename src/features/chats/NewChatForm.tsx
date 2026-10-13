import { useState, type SubmitEvent } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ErrorText, PrimaryButton, Spinner } from '../../components/ui';
import { createChat, createErrorCleared, selectCreateChatError, selectCreateChatStatus } from './chatsSlice';
import { COUNTRIES, maskCapacity, type Country } from './countries';
import { PhoneInput } from './PhoneInput';

export function NewChatForm({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectCreateChatStatus);
  const error = useAppSelector(selectCreateChatError);
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [digits, setDigits] = useState('');

  const isLoading = status === 'loading';
  const isComplete = digits.length === maskCapacity(country.mask);

  const handleChange = (value: { country: Country; digits: string }) => {
    setCountry(value.country);
    setDigits(value.digits);
    if (error) dispatch(createErrorCleared());
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isComplete || isLoading) return;
    const result = await dispatch(createChat(`${country.dialCode}${digits}`));
    if (createChat.fulfilled.match(result)) onClose();
  };

  return (
    <Form onSubmit={handleSubmit}>
      <PhoneInput
        country={country}
        digits={digits}
        onChange={handleChange}
        invalid={Boolean(error)}
        disabled={isLoading}
      />
      {error && <ErrorText role="alert">{error}</ErrorText>}
      <SubmitButton type="submit" disabled={isLoading || !isComplete}>
        {isLoading && <Spinner />}
        Найти в MAX
      </SubmitButton>
    </Form>
  );
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SubmitButton = styled(PrimaryButton)`
  width: 100%;
  height: 52px;
  margin-top: 24px;
  border-radius: 14px;
  font-size: 16px;
`;
