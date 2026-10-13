import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { ChevronDownIcon, SearchIcon } from '../../components/icons';
import { applyMask, COUNTRIES, maskCapacity, maskPlaceholder, splitInternationalNumber, type Country } from './countries';

interface PhoneInputProps {
  country: Country;
  digits: string;
  onChange: (value: { country: Country; digits: string }) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/** Поле номера телефона с выбором страны и маской ввода, как в MAX. */
export function PhoneInput({ country, digits, onChange, invalid = false, disabled = false }: PhoneInputProps) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Сколько цифр должно оказаться перед курсором после переформатирования. */
  const caretDigitsRef = useRef<number | null>(null);

  const capacity = maskCapacity(country.mask);
  const formatted = applyMask(digits, country.mask);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const digitsBeforeCaret = caretDigitsRef.current;
    if (!input || digitsBeforeCaret === null) return;
    caretDigitsRef.current = null;

    let position = 0;
    for (let seen = 0; position < formatted.length && seen < digitsBeforeCaret; position += 1) {
      if (/\d/.test(formatted[position])) seen += 1;
    }
    input.setSelectionRange(position, position);
  }, [formatted]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = event.target;
    let nextDigits = value.replace(/\D/g, '');
    let digitsBeforeCaret = value.slice(0, selectionStart ?? value.length).replace(/\D/g, '').length;

    // Стёрли разделитель маски — стираем цифру перед ним, иначе Backspace «застревает».
    if (nextDigits === digits && value.length < formatted.length && digitsBeforeCaret > 0) {
      nextDigits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret);
      digitsBeforeCaret -= 1;
    }

    if (nextDigits.length > capacity) {
      const isPaste = nextDigits.length - digits.length > 1;
      const parsed = isPaste ? splitInternationalNumber(nextDigits) : null;
      if (parsed) {
        caretDigitsRef.current = parsed.national.length;
        onChange({ country: parsed.country, digits: parsed.national });
        return;
      }
      nextDigits = nextDigits.slice(0, capacity);
    }

    caretDigitsRef.current = Math.min(digitsBeforeCaret, nextDigits.length);
    onChange({ country, digits: nextDigits });
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
  };

  const selectCountry = (next: Country) => {
    onChange({ country: next, digits: digits.slice(0, maskCapacity(next.mask)) });
    closeDropdown();
    inputRef.current?.focus();
  };

  const normalizedQuery = query.trim().toLowerCase().replace(/^\+/, '');
  const visibleCountries = COUNTRIES.filter(
    (item) => item.name.toLowerCase().includes(normalizedQuery) || item.dialCode.startsWith(normalizedQuery),
  );

  const handleDropdownKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Иначе Esc закроет всё модальное окно, а не только список стран.
      event.preventDefault();
      event.stopPropagation();
      closeDropdown();
      inputRef.current?.focus();
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      // Иначе Enter в поиске отправит форму.
      event.preventDefault();
      if (visibleCountries[0]) selectCountry(visibleCountries[0]);
    }
  };

  return (
    <Root ref={rootRef}>
      <Field $invalid={invalid}>
        <CountryButton
          type="button"
          onClick={() => (isOpen ? closeDropdown() : setOpen(true))}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Страна: ${country.name}, +${country.dialCode}`}
        >
          <Flag id={country.id} />
          <span>+{country.dialCode}</span>
          <Chevron $open={isOpen}>
            <ChevronDownIcon size={18} />
          </Chevron>
        </CountryButton>
        <NumberInput
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label="Номер телефона"
          aria-invalid={invalid}
          placeholder={maskPlaceholder(country.mask)}
          value={formatted}
          onChange={handleInputChange}
          disabled={disabled}
          data-autofocus
        />
      </Field>

      {isOpen && (
        <Dropdown onKeyDown={handleDropdownKeyDown}>
          <Search>
            <SearchIcon size={20} />
            <input
              placeholder="Найти страну"
              aria-label="Найти страну"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </Search>
          <CountryList role="listbox" aria-label="Страна">
            {visibleCountries.map((item) => (
              <li key={item.id} role="option" aria-selected={item.id === country.id}>
                <CountryOption type="button" $selected={item.id === country.id} onClick={() => selectCountry(item)}>
                  <Flag id={item.id} />
                  <CountryName>{item.name}</CountryName>
                  <DialCode>+{item.dialCode}</DialCode>
                </CountryOption>
              </li>
            ))}
            {visibleCountries.length === 0 && <NotFound>Ничего не найдено</NotFound>}
          </CountryList>
        </Dropdown>
      )}
    </Root>
  );
}

/** Флаги нарисованы в SVG: Windows не отображает эмодзи флагов и показывает вместо них буквы. */
function Flag({ id }: { id: Country['id'] }) {
  if (id === 'RU') {
    return (
      <FlagImage viewBox="0 0 9 6" preserveAspectRatio="none" aria-hidden="true">
        <rect width="9" height="2" fill="#ffffff" />
        <rect y="2" width="9" height="2" fill="#0039a6" />
        <rect y="4" width="9" height="2" fill="#d52b1e" />
      </FlagImage>
    );
  }
  return (
    <FlagImage viewBox="0 0 18 9" preserveAspectRatio="none" aria-hidden="true">
      <rect width="18" height="9" fill="#c8313e" />
      <rect y="6" width="18" height="3" fill="#4aa657" />
      <rect width="2" height="9" fill="#ffffff" />
      <path d="M1 .4 1.7 1.5 1 2.6.3 1.5ZM1 3.4l.7 1.1L1 5.6.3 4.5ZM1 6.4l.7 1.1L1 8.6.3 7.5Z" fill="#c8313e" />
    </FlagImage>
  );
}

const Root = styled.div`
  position: relative;
`;

const Field = styled.div<{ $invalid: boolean }>`
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  border: 1px solid ${({ theme, $invalid }) => ($invalid ? theme.colors.danger : 'transparent')};
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.background};
  transition: border-color 0.15s;

  &:focus-within {
    border-color: ${({ theme, $invalid }) => ($invalid ? theme.colors.danger : theme.colors.accent)};
  }
`;

const CountryButton = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  margin-right: 10px;
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.text};
  font-size: 16px;
`;

const Chevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  transform: rotate(${({ $open }) => ($open ? '180deg' : '0deg')});
  transition: transform 0.15s;
`;

const NumberInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  outline: none;
  font-size: 16px;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const FlagImage = styled.svg`
  flex-shrink: 0;
  width: 22px;
  height: 15px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(26, 28, 34, 0.08);
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 16px;
  left: 16px;
  z-index: 1;
  padding: 8px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 8px 32px rgba(26, 28, 34, 0.16);
`;

const Search = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.textSecondary};

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    outline: none;
    color: ${({ theme }) => theme.colors.text};
    font-size: 15px;
  }
`;

const CountryList = styled.ul`
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
`;

const CountryOption = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: none;
  border-radius: 12px;
  background: ${({ theme, $selected }) => ($selected ? theme.colors.surfaceHover : 'none')};
  color: ${({ theme }) => theme.colors.text};
  font-size: 15px;
  text-align: left;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const CountryName = styled.span`
  flex: 1;
`;

const DialCode = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const NotFound = styled.li`
  padding: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 14px;
  text-align: center;
`;
