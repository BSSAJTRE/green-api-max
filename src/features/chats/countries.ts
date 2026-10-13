export interface Country {
  id: 'RU' | 'BY';
  name: string;
  dialCode: string;
  /** Маска национальной части номера, # — цифра. */
  mask: string;
}

/** CheckAccount в GREEN-API принимает номера только этих стран. */
export const COUNTRIES: Country[] = [
  { id: 'RU', name: 'Россия', dialCode: '7', mask: '### ### ## ##' },
  { id: 'BY', name: 'Беларусь', dialCode: '375', mask: '## ### ## ##' },
];

export const maskCapacity = (mask: string) => mask.split('#').length - 1;

/** Расставляет разделители маски между цифрами; лишние цифры отбрасываются. */
export function applyMask(digits: string, mask: string): string {
  let result = '';
  let index = 0;
  for (const char of mask) {
    if (index >= digits.length) break;
    if (char === '#') {
      result += digits[index];
      index += 1;
    } else {
      result += char;
    }
  }
  return result;
}

export const maskPlaceholder = (mask: string) => applyMask('1234567890', mask);

/** Разбирает вставленный номер в международном формате (+7…, 8…, +375…) на страну и национальную часть. */
export function splitInternationalNumber(digits: string): { country: Country; national: string } | null {
  for (const country of COUNTRIES) {
    if (digits.length === country.dialCode.length + maskCapacity(country.mask) && digits.startsWith(country.dialCode)) {
      return { country, national: digits.slice(country.dialCode.length) };
    }
  }
  const russia = COUNTRIES[0];
  if (digits.length === 1 + maskCapacity(russia.mask) && digits.startsWith('8')) {
    return { country: russia, national: digits.slice(1) };
  }
  return null;
}
