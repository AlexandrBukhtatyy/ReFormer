/**
 * Маска ввода: `9` — цифра, остальное — литералы. Литералы дописываются только перед следующей
 * цифрой, поэтому Backspace не упирается в хвостовой разделитель.
 *
 * Введённый текст разбирается по позициям маски: то, что уже стоит по маске (литералы на своих
 * местах, в слотах — цифры), даёт цифры слотов — цифры-литералы маски (`7` в `+7 (999) …`, `0` в
 * `99-0-99`) повторно не вводятся, и отформатированное значение проходит через маску без изменений.
 * Набранный руками префикс с нецифрой (`+7`) — тоже литерал. Текст не по маске — цифры как есть:
 * лишние ведущие цифры по числу цифр префикса — код страны или междугородний код вставленного номера
 * (`79001234567`, `89001234567`) — отбрасываются.
 *
 * @example
 * ```ts
 * applyMask('9001234567', '+7 (999) 999-99-99'); // '+7 (900) 123-45-67'
 * applyMask('+7 (900) 123-45-67', '+7 (999) 999-99-99'); // '+7 (900) 123-45-67'
 * applyMask('79001234567', '+7 (999) 999-99-99'); // '+7 (900) 123-45-67'
 * applyMask('8', '8 (999) 999-99-99'); // '8 (8'
 * ```
 */
export function applyMask(raw: string, mask: string): string {
  const slots = [...mask].filter((char) => char === '9').length;
  const firstSlot = mask.indexOf('9');
  const prefix = firstSlot === -1 ? mask : mask.slice(0, firstSlot);
  const prefixDigits = prefix.replace(/\D/g, '');

  // Сколько текста уже стоит по маске.
  let at = 0;
  let typed = '';
  while (at < raw.length && at < mask.length) {
    const slot = mask[at] === '9';
    if (slot ? !/\d/.test(raw[at]) : raw[at] !== mask[at]) break;
    if (slot) typed += raw[at];
    at++;
  }

  let digits: string;
  if (at >= prefix.length || /\D/.test(raw.slice(0, at))) {
    digits = typed + raw.slice(at).replace(/\D/g, '');
  } else {
    digits = raw.replace(/\D/g, '');
    if (prefixDigits && digits.length >= slots + prefixDigits.length) {
      digits = digits.slice(prefixDigits.length);
    }
  }
  if (!digits) return '';

  let out = '';
  let index = 0;
  for (const char of mask) {
    if (index >= digits.length) break;
    if (char === '9') out += digits[index++];
    else out += char;
  }
  return out;
}
