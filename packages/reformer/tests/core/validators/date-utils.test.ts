/**
 * Утилиты дат валидаторов: `parseDate`, `getToday`, `normalizeDate`, `calculateAge`.
 *
 * Регрессия `calculateAge`: возраст считался делением миллисекунд на усреднённый год (365.25 дн) —
 * в день N-летия выходило N−1, и `minAge(18)` отклонял того, кому ровно 18 сегодня. Теперь возраст
 * считается по календарным полям. «Сегодня» — фейковые часы, даты — локальными конструкторами
 * `new Date(y, m, d)`: результат не зависит ни от дня запуска, ни от часового пояса. Строка
 * `YYYY-MM-DD` — локальная полночь (раньше — полночь UTC, сдвиг дня западнее UTC проверяет зонд
 * `date-iso-strings-tz.test.ts`, [ReFormer-nxod]); несуществующая дата не разбирается [ReFormer-eei6].
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateAge,
  getToday,
  normalizeDate,
  parseDate,
} from '../../../src/form/validators/date-utils';
import { useFakeClock } from '../../test-utils/async';

/** Календарные поля локальной даты — компактно для утверждений. */
const ymd = (date: Date): [number, number, number] => [
  date.getFullYear(),
  date.getMonth() + 1,
  date.getDate(),
];

describe('parseDate — разбор значения', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['пустая строка', ''],
    ['невалидная строка', 'not-a-date'],
    ['невалидный Date', new Date(Number.NaN)],
  ])('%s → null', (_label, value) => {
    expect(parseDate(value)).toBeNull();
  });

  it('валидный Date возвращается тем же экземпляром', () => {
    const date = new Date(2024, 5, 15, 10, 30);
    expect(parseDate(date)).toBe(date);
  });

  it('строка даты-времени без смещения разбирается как локальное время', () => {
    const parsed = parseDate('2024-06-15T10:30');
    expect(parsed && [...ymd(parsed), parsed.getHours(), parsed.getMinutes()]).toEqual([
      2024, 6, 15, 10, 30,
    ]);
  });

  it('строка YYYY-MM-DD — локальная полночь этого дня [ReFormer-nxod]', () => {
    const parsed = parseDate('2024-06-15');
    expect(parsed && [...ymd(parsed), parsed.getHours(), parsed.getMinutes()]).toEqual([
      2024, 6, 15, 0, 0,
    ]);
  });

  it('год меньше 100 не превращается в 19xx', () => {
    const parsed = parseDate('0099-12-31');
    expect(parsed && ymd(parsed)).toEqual([99, 12, 31]);
  });

  it.each(['2023-02-29', '2024-02-30', '2024-13-01', '2024-00-10', '2024-06-00'])(
    'несуществующая дата %s → null [ReFormer-eei6]',
    (value) => {
      expect(parseDate(value)).toBeNull();
    }
  );

  it('не строка и не Date (число-метка времени, объект) → null', () => {
    expect(parseDate(0 as never)).toBeNull();
    expect(parseDate(Date.UTC(2024, 5, 15) as never)).toBeNull();
    expect(parseDate({} as never)).toBeNull();
  });
});

describe('getToday — сегодня с обнулённым временем', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12, 34, 56, 789)));
  afterEach(() => vi.useRealTimers());

  it('возвращает локальную полночь текущего дня', () => {
    expect(getToday()).toEqual(new Date(2024, 5, 15));
  });

  it('каждый вызов — новый объект: мутация результата не влияет на следующий', () => {
    const first = getToday();
    first.setFullYear(2000);
    expect(getToday()).toEqual(new Date(2024, 5, 15));
  });

  it('берёт время в момент вызова', () => {
    vi.setSystemTime(new Date(2024, 11, 31, 23, 59, 59, 999));
    expect(getToday()).toEqual(new Date(2024, 11, 31));
  });
});

describe('normalizeDate — обнуление времени', () => {
  it('возвращает локальную полночь того же дня', () => {
    expect(normalizeDate(new Date(2024, 5, 15, 23, 59, 59, 999))).toEqual(new Date(2024, 5, 15));
  });

  it('не мутирует аргумент', () => {
    const date = new Date(2024, 5, 15, 18, 30);
    const normalized = normalizeDate(date);
    expect(normalized).not.toBe(date);
    expect(date).toEqual(new Date(2024, 5, 15, 18, 30));
  });
});

describe('calculateAge — полные годы по календарным полям', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  it('в день N-летия возвращает N (regression: был N−1)', () => {
    expect(calculateAge(new Date(2006, 5, 15))).toBe(18); // день рождения сегодня
    expect(calculateAge(new Date(2006, 5, 14))).toBe(18); // был вчера
    expect(calculateAge(new Date(2006, 5, 16))).toBe(17); // завтра — ещё 17
  });

  it('месяц рождения позже текущего — год ещё не исполнился', () => {
    expect(calculateAge(new Date(2006, 6, 1))).toBe(17);
    expect(calculateAge(new Date(2006, 4, 31))).toBe(18);
  });

  it('старше и младше', () => {
    expect(calculateAge(new Date(1984, 5, 15))).toBe(40);
    expect(calculateAge(new Date(2024, 5, 10))).toBe(0);
    expect(calculateAge(new Date(2023, 5, 16))).toBe(0); // почти год, но ещё не исполнился
  });

  it('время рождения не учитывается', () => {
    expect(calculateAge(new Date(2006, 5, 15, 23, 59))).toBe(18);
  });

  // поведение под вопросом [ReFormer-iioz]: дата рождения в будущем даёт отрицательный возраст — в params
  // замечания minAge попадёт currentAge: -1.
  it('дата рождения в будущем — отрицательный возраст', () => {
    expect(calculateAge(new Date(2025, 0, 1))).toBe(-1);
  });

  // поведение под вопросом [ReFormer-iioz]: в невисокосный год рождённый 29 февраля становится старше 1 марта;
  // в разных юрисдикциях днём рождения в такой год считают 28 февраля или 1 марта.
  it('рождённый 29 февраля: в невисокосный год 28 февраля возраст ещё прежний', () => {
    vi.setSystemTime(new Date(2023, 1, 28, 12));
    expect(calculateAge(new Date(2004, 1, 29))).toBe(18);
  });

  it('рождённый 29 февраля: в невисокосный год 1 марта возраст увеличивается', () => {
    vi.setSystemTime(new Date(2023, 2, 1, 12));
    expect(calculateAge(new Date(2004, 1, 29))).toBe(19);
  });

  it('рождённый 29 февраля: в високосный год возраст увеличивается 29 февраля', () => {
    vi.setSystemTime(new Date(2024, 1, 29, 12));
    expect(calculateAge(new Date(2004, 1, 29))).toBe(20);
    vi.setSystemTime(new Date(2024, 1, 28, 12));
    expect(calculateAge(new Date(2004, 1, 29))).toBe(19);
  });
});
