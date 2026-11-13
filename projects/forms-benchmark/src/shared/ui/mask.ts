/**
 * Маска ввода: `9` — цифра, остальное — литералы. Литералы дописываются только перед следующей
 * цифрой, поэтому Backspace не упирается в хвостовой разделитель.
 *
 * Ведущие цифры-литералы маски (`7` в `+7 (999) …`) повторно не вводятся: если сырое значение уже
 * начинается с префикса маски, его цифры отбрасываются.
 */
export function applyMask(raw: string, mask: string): string {
  const prefix = mask.slice(0, mask.indexOf('9') === -1 ? mask.length : mask.indexOf('9'));
  const prefixDigits = prefix.replace(/\D/g, '');
  let digits = raw.replace(/\D/g, '');
  const trimmedPrefix = prefix.trimEnd().replace(/\D+$/, '');
  if (prefixDigits && raw.startsWith(trimmedPrefix)) digits = digits.slice(prefixDigits.length);
  if (!digits) return '';

  let out = '';
  let i = 0;
  for (const ch of mask) {
    if (i >= digits.length) break;
    if (ch === '9') out += digits[i++];
    else out += ch;
  }
  return out;
}
