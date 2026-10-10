/**
 * Свойства правил дат на случайных календарных днях (fast-check, фейковые часы).
 *
 * Возраст сверяется с эталонной арифметикой, записанной иначе, чем в коде: «сколько годовщин
 * рождения уже наступило», где годовщина `n` — `new Date(год + n, месяц, день)`. Для рождённых
 * 29 февраля в невисокосный год Date переносит годовщину на 1 марта — это и есть текущая семантика
 * правила (см. «поведение под вопросом» в date-utils.test.ts). `minDate` / `maxDate` / `pastDate` /
 * `futureDate` сверяются со сравнением календарных дней при случайном времени значения, границы и
 * «сейчас». Дни — 1900–2100, с подмешанными 28/29 февраля и 1 марта; даты — локальными
 * конструкторами. Воспроизведение: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { calculateAge } from '../../../src/form/validators/date-utils';
import {
  futureDate,
  maxAge,
  maxDate,
  minAge,
  minDate,
  pastDate,
} from '../../../src/form/validators';
import { useFakeClock } from '../../test-utils/async';
import { propertyParams } from '../../test-utils/property';

/** Календарный день: месяц с нуля, как у `Date`. */
interface Day {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

const MS_PER_DAY = 86_400_000;
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (y: number, m: number): number =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];

const year = fc.integer({ min: 1900, max: 2100 });
const anyDay: fc.Arbitrary<Day> = fc
  .record({ y: year, m: fc.integer({ min: 0, max: 11 }), d: fc.integer({ min: 1, max: 31 }) })
  .map(({ y, m, d }) => ({ y, m, d: Math.min(d, daysIn(y, m)) }));
const leapYear = fc
  .integer({ min: 475, max: 525 })
  .map((q) => q * 4)
  .filter(isLeap);
const februaryEdge: fc.Arbitrary<Day> = fc.oneof(
  leapYear.map((y) => ({ y, m: 1, d: 29 })),
  year.map((y) => ({ y, m: 1, d: 28 })),
  year.map((y) => ({ y, m: 2, d: 1 }))
);
const day = fc.oneof({ arbitrary: anyDay, weight: 3 }, { arbitrary: februaryEdge, weight: 2 });
const timeOfDay = fc.integer({ min: 0, max: MS_PER_DAY - 1 });

/** Момент внутри дня: локальная полночь плюс `ms`. */
const at = (value: Day, ms = 0): Date => new Date(value.y, value.m, value.d, 0, 0, 0, ms);
/** Ключ календарного дня для сравнения: ГГГГММДД. */
const keyOf = (date: Date): number =>
  date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();
const dayKey = (value: Day): number => keyOf(at(value));

/** Эталонный возраст: сколько годовщин рождения уже наступило к `today`. */
const referenceAge = (birth: Day, today: Day): number => {
  let years = today.y - birth.y + 1;
  while (keyOf(new Date(birth.y + years, birth.m, birth.d)) > dayKey(today)) years -= 1;
  return years;
};

beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
afterEach(() => vi.useRealTimers());

describe('date-validators — возраст против эталонной арифметики', () => {
  it('calculateAge совпадает с числом наступивших годовщин (время рождения и «сейчас» случайны)', () => {
    fc.assert(
      fc.property(day, timeOfDay, day, timeOfDay, (birth, birthMs, today, nowMs) => {
        vi.setSystemTime(at(today, nowMs));
        expect(calculateAge(at(birth, birthMs))).toBe(referenceAge(birth, today));
      }),
      propertyParams()
    );
  });

  it('minAge(n): проходит ровно возраст ≥ n, иначе { minAge: n, currentAge }', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        day,
        day,
        timeOfDay,
        (n, birth, today, nowMs) => {
          vi.setSystemTime(at(today, nowMs));
          const currentAge = referenceAge(birth, today);
          const expected =
            currentAge >= n ? null : { code: 'date_min_age', params: { minAge: n, currentAge } };
          expect(minAge(n)(at(birth))).toEqual(expected);
        }
      ),
      propertyParams()
    );
  });

  it('maxAge(n): проходит ровно возраст ≤ n, иначе { maxAge: n, currentAge }', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        day,
        day,
        timeOfDay,
        (n, birth, today, nowMs) => {
          vi.setSystemTime(at(today, nowMs));
          const currentAge = referenceAge(birth, today);
          const expected =
            currentAge <= n ? null : { code: 'date_max_age', params: { maxAge: n, currentAge } };
          expect(maxAge(n)(at(birth))).toEqual(expected);
        }
      ),
      propertyParams()
    );
  });
});

describe('date-validators — границы сравнивают календарные дни, время игнорируется', () => {
  it('minDate: проходит ровно день значения ≥ дня границы', () => {
    fc.assert(
      fc.property(day, timeOfDay, day, timeOfDay, (bound, boundMs, value, valueMs) => {
        const limit = at(bound, boundMs);
        const expected =
          dayKey(value) >= dayKey(bound) ? null : { code: 'date_min', params: { minDate: limit } };
        expect(minDate(limit)(at(value, valueMs))).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('maxDate: проходит ровно день значения ≤ дня границы', () => {
    fc.assert(
      fc.property(day, timeOfDay, day, timeOfDay, (bound, boundMs, value, valueMs) => {
        const limit = at(bound, boundMs);
        const expected =
          dayKey(value) <= dayKey(bound) ? null : { code: 'date_max', params: { maxDate: limit } };
        expect(maxDate(limit)(at(value, valueMs))).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('pastDate / futureDate: сегодня проходит у обоих, остальное — по сравнению дней', () => {
    fc.assert(
      fc.property(day, timeOfDay, day, timeOfDay, (today, nowMs, value, valueMs) => {
        vi.setSystemTime(at(today, nowMs));
        const date = at(value, valueMs);
        const diff = dayKey(value) - dayKey(today);
        expect([pastDate()(date), futureDate()(date)]).toEqual([
          diff > 0 ? { code: 'date_future' } : null,
          diff < 0 ? { code: 'date_past' } : null,
        ]);
      }),
      propertyParams()
    );
  });
});
