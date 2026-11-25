// @vitest-environment happy-dom
/**
 * Маска форматирует ввод: цифры встают в слоты шаблона, литералы подставляются, прочие символы
 * отбрасываются. То же поведение у одноимённого компонента китов других библиотек.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { InputMask } from './index';
import { applyMask } from '@/lib/apply-mask';

afterEach(cleanup);

const PHONE = '+7 (999) 999-99-99';

function typeInto(mask: string | undefined, text: string): unknown {
  const onChange = vi.fn();
  const { container } = render(<InputMask mask={mask} value="" onChange={onChange} />);
  const input = container.querySelector('input')!;
  fireEvent.change(input, { target: { value: text } });
  return onChange.mock.calls.at(-1)?.[0];
}

describe('InputMask: ввод по маске', () => {
  it('цифры встают в слоты, литералы подставляются', () => {
    expect(typeInto(PHONE, '9001234567')).toBe('+7 (900) 123-45-67');
  });

  it('уже отформатированное значение не меняется', () => {
    expect(typeInto(PHONE, '+7 (900) 123-45-67')).toBe('+7 (900) 123-45-67');
  });

  it('буквы отбрасываются; ввод без цифр — null', () => {
    expect(typeInto('99 99', '1a2b3')).toBe('12 3');
    expect(typeInto('99 99', 'abc')).toBeNull();
  });

  it('без маски значение уходит как введено', () => {
    expect(typeInto(undefined, 'abc')).toBe('abc');
  });
});

const PHONE_MASK = '+7 (999) 999-99-99';
const PHONE_VALUE = '+7 (900) 123-45-67';

/** Ввод → значение после маски. */
const MASK_CASES: ReadonlyArray<readonly [string, string, string]> = [
  ['9001234567', PHONE_MASK, PHONE_VALUE],
  [PHONE_VALUE, PHONE_MASK, PHONE_VALUE],
  // Вставка номера с кодом страны или междугородним кодом: лишняя ведущая цифра отбрасывается.
  ['79001234567', PHONE_MASK, PHONE_VALUE],
  ['89001234567', PHONE_MASK, PHONE_VALUE],
  ['+79001234567', PHONE_MASK, PHONE_VALUE],
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
  it('литералы — только перед следующей цифрой: Backspace не упирается в разделитель', () => {
    expect(applyMask('900', PHONE)).toBe('+7 (900');
    expect(applyMask('9001', PHONE)).toBe('+7 (900) 1');
  });

  it('цифры сверх шаблона отбрасываются', () => {
    expect(applyMask('1234567', '999-999')).toBe('123-456');
  });

  it.each(MASK_CASES)('«%s» по маске «%s» → «%s»', (raw, mask, expected) => {
    expect(applyMask(raw, mask)).toBe(expected);
  });
});
