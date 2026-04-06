export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} км` : `${Math.round(meters)} м`;
}

export function formatMinutes(milliseconds: number) {
  return `${Math.max(1, Math.ceil(milliseconds / 60000))} мин`;
}

export function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^8/, '7');
  const normalized = digits.startsWith('7') ? digits : `7${digits}`;
  const sliced = normalized.slice(0, 11);
  const parts = [
    sliced.slice(1, 4),
    sliced.slice(4, 7),
    sliced.slice(7, 9),
    sliced.slice(9, 11),
  ].filter(Boolean);

  let result = '+7';
  if (parts[0]) result += ` (${parts[0]}`;
  if (parts[0]?.length === 3) result += ')';
  if (parts[1]) result += ` ${parts[1]}`;
  if (parts[2]) result += `-${parts[2]}`;
  if (parts[3]) result += `-${parts[3]}`;
  return result;
}

export function phoneIsValid(value: string) {
  return value.replace(/\D/g, '').length === 11;
}

export function codeIsValid(value: string) {
  return /^\d{4}$/.test(value);
}
