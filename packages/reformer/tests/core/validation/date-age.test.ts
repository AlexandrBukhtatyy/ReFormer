/**
 * Regression: calculateAge / minAge / maxAge на границе года рождения.
 *
 * Баг (до фикса): возраст считался делением миллисекунд на усреднённый год (365.25 дн), что давало
 * off-by-one в день рождения — `minAge(18)` отклонял человека, которому ровно 18 сегодня.
 * Даты в тестах вычисляются относительно `getToday()` → детерминированно (не зависит от «когда запущен»).
 */

import { describe, it, expect } from 'vitest';
import { calculateAge, getToday } from '../../../src/core/validation/validators/date-utils';
import { minAge } from '../../../src/core/validation/validators/min-age';
import { maxAge } from '../../../src/core/validation/validators/max-age';

/** Дата рождения ровно `years` лет назад со сдвигом `dayOffset` дней (относительно сегодня). */
function birthDate(years: number, dayOffset = 0): Date {
  const t = getToday();
  return new Date(t.getFullYear() - years, t.getMonth(), t.getDate() + dayOffset);
}

// Валидаторы игнорируют control/root — зовём только со значением.
const asValueFn = (v: (value: unknown, c?: unknown, r?: unknown) => unknown) => (value: unknown) =>
  v(value);

describe('calculateAge (calendar-field, без усреднения 365.25)', () => {
  it('в день N-летия возвращает N (regression: был N−1)', () => {
    expect(calculateAge(birthDate(18, 0))).toBe(18); // день рождения сегодня
    expect(calculateAge(birthDate(18, -1))).toBe(18); // ДР был вчера
    expect(calculateAge(birthDate(18, +1))).toBe(17); // ДР завтра — ещё 17
  });

  it('старше/младше', () => {
    expect(calculateAge(birthDate(40, 0))).toBe(40);
    expect(calculateAge(birthDate(0, -5))).toBe(0);
    expect(calculateAge(birthDate(1, +1))).toBe(0); // почти год, но ещё не исполнился
  });
});

describe('minAge / maxAge на границе допуска', () => {
  it('minAge(18) пропускает того, кому ровно 18 сегодня (regression)', () => {
    const v = asValueFn(minAge(18) as never);
    expect(v(birthDate(18, 0))).toBeNull(); // ровно 18 → OK
    expect(v(birthDate(18, -1))).toBeNull(); // 18 (ДР вчера) → OK
    expect(v(birthDate(18, +1))).not.toBeNull(); // 17 → ошибка
  });

  it('maxAge(65): 65 включительно OK, 66 — ошибка', () => {
    const v = asValueFn(maxAge(65) as never);
    expect(v(birthDate(65, 0))).toBeNull(); // ровно 65 → OK (age > 65 ложно)
    expect(v(birthDate(66, -1))).not.toBeNull(); // 66 → ошибка
  });

  it('пустые/невалидные значения пропускаются', () => {
    const v = asValueFn(minAge(18) as never);
    expect(v('')).toBeNull();
    expect(v(null)).toBeNull();
    expect(v('not-a-date')).toBeNull();
  });
});
