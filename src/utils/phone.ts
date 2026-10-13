/** CheckAccount принимает только номера РФ (7) и РБ (375) в международном формате. */
const SUPPORTED_PHONE = /^(7\d{10}|375\d{9})$/;

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

export function isSupportedPhone(phone: string): boolean {
  return SUPPORTED_PHONE.test(phone);
}

export function formatPhone(phone: string): string {
  if (/^7\d{10}$/.test(phone)) {
    return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  if (/^375\d{9}$/.test(phone)) {
    return `+375 ${phone.slice(3, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`;
  }
  return phone ? `+${phone}` : '';
}
