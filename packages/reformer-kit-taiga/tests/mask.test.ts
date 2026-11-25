/**
 * Маска `InputMask` — та же, что у `@reformer/ui-kit`: одно имя каталога ведёт себя одинаково на всех
 * стеках.
 */
import { describe, expect, it } from 'vitest';
import { applyMask } from '../src/lib/mask';

const PHONE_MASK = '+7 (999) 999-99-99';
const PHONE = '+7 (900) 123-45-67';

/** Ввод → значение после маски. */
const MASK_CASES: ReadonlyArray<readonly [string, string, string]> = [
  ['9001234567', PHONE_MASK, PHONE],
  [PHONE, PHONE_MASK, PHONE],
  // Вставка номера с кодом страны или междугородним кодом: лишняя ведущая цифра отбрасывается.
  ['79001234567', PHONE_MASK, PHONE],
  ['89001234567', PHONE_MASK, PHONE],
  ['+79001234567', PHONE_MASK, PHONE],
  // Удаление: литералы префикса без цифр — пусто; символ из середины — цифры сдвигаются.
  ['+7 (', PHONE_MASK, ''],
  ['+7 (90) 123-45-67', PHONE_MASK, '+7 (901) 234-56-7'],
  // Маска с цифрой в префиксе: первая введённая цифра — цифра номера, а не префикс.
  ['8', '8 (999) 999-99-99', '8 (8'],
  ['8 (812', '8 (999) 999-99-99', '8 (812'],
  // Цифра-литерал в середине маски не вводится повторно.
  ['1234', '99-0-99', '12-0-34'],
  ['12-0-34', '99-0-99', '12-0-34'],
];

describe('applyMask', () => {
  it.each(MASK_CASES)('«%s» по маске «%s» → «%s»', (raw, mask, expected) => {
    expect(applyMask(raw, mask)).toBe(expected);
  });
});
