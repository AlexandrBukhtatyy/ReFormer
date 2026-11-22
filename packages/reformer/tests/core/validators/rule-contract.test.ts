/**
 * Общий контракт ВСЕХ фабрик правил `@reformer/core/validators`.
 *
 * Таблица «имя → фабрика с аргументами → допустимое и недопустимое значение» обязана перечислять
 * каждый экспорт `validators/index.ts`, кроме утилит файлов (`isFileLike`, `matchesFileAccept`,
 * `toFileArray`): новая фабрика без строки в таблице роняет тест полноты (и `tsc` — тип таблицы
 * выведен из экспортов). По каждой фабрике: пустые значения (`null` / `undefined` / `''`) дают
 * `null` — кроме `required`; `{ code }` подменяет код; `{ params }` сливаются с параметрами правила,
 * из опций — главнее; у замечания нет текста и `severity`; повторный вызов на том же значении даёт
 * тот же результат (регрессия флага `/g`); проверяемое значение не мутируется. Даты считаются от
 * фейковых часов 15.06.2024 12:00 локального времени.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as validators from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { RuleOptions } from '../../../src/form/types/validation-schema';
import { useFakeClock } from '../../test-utils/async';

/** Экспорты-утилиты: не правила, в таблицу не входят. */
const UTILITIES = ['isFileLike', 'matchesFileAccept', 'toFileArray'] as const;

type RuleName = Exclude<keyof typeof validators, (typeof UTILITIES)[number]>;
type AnyRule = (value: never) => ValidationIssue | null;

interface ContractRow {
  /** Фабрика с фиксированными аргументами; опции правила — последним аргументом. */
  readonly make: (options?: RuleOptions) => AnyRule;
  /** Значение, которое правило пропускает. */
  readonly valid: unknown;
  /** Значение, на которое правило даёт замечание. */
  readonly invalid: unknown;
  /** Встроенный код замечания на `invalid`. */
  readonly code: string;
}

const file = (name: string, size: number) => ({ name, size });

const TABLE: Record<RuleName, ContractRow> = {
  required: { make: (o) => validators.required(o), valid: 'x', invalid: null, code: 'required' },
  min: { make: (o) => validators.min(10, o), valid: 10, invalid: 5, code: 'min' },
  max: { make: (o) => validators.max(5, o), valid: 5, invalid: 10, code: 'max' },
  minLength: {
    make: (o) => validators.minLength(3, o),
    valid: 'abc',
    invalid: 'ab',
    code: 'minLength',
  },
  maxLength: {
    make: (o) => validators.maxLength(3, o),
    valid: 'abc',
    invalid: 'abcd',
    code: 'maxLength',
  },
  email: { make: (o) => validators.email(o), valid: 'a@b.co', invalid: 'a@b', code: 'email' },
  pattern: {
    make: (o) => validators.pattern(/^\d+$/g, o),
    valid: '123',
    invalid: 'abc',
    code: 'pattern',
  },
  url: {
    make: (o) => validators.url(o),
    valid: 'https://example.com',
    invalid: 'not a url',
    code: 'url',
  },
  phone: { make: (o) => validators.phone(o), valid: '+79991234567', invalid: 'abc', code: 'phone' },
  isNumber: {
    make: (o) => validators.isNumber(o),
    valid: 1,
    invalid: Number.NaN,
    code: 'isNumber',
  },
  integer: { make: (o) => validators.integer(o), valid: 2, invalid: 2.5, code: 'integer' },
  multipleOf: {
    make: (o) => validators.multipleOf(5, o),
    valid: 10,
    invalid: 7,
    code: 'multipleOf',
  },
  nonNegative: {
    make: (o) => validators.nonNegative(o),
    valid: 0,
    invalid: -1,
    code: 'nonNegative',
  },
  nonZero: { make: (o) => validators.nonZero(o), valid: 1, invalid: 0, code: 'nonZero' },
  isDate: {
    make: (o) => validators.isDate(o),
    valid: new Date(2024, 0, 1),
    invalid: 'not-a-date',
    code: 'date_invalid',
  },
  minDate: {
    make: (o) => validators.minDate(new Date(2024, 0, 10), o),
    valid: new Date(2024, 0, 10),
    invalid: new Date(2024, 0, 9),
    code: 'date_min',
  },
  maxDate: {
    make: (o) => validators.maxDate(new Date(2024, 0, 10), o),
    valid: new Date(2024, 0, 10),
    invalid: new Date(2024, 0, 11),
    code: 'date_max',
  },
  pastDate: {
    make: (o) => validators.pastDate(o),
    valid: new Date(2024, 5, 15),
    invalid: new Date(2024, 5, 16),
    code: 'date_future',
  },
  futureDate: {
    make: (o) => validators.futureDate(o),
    valid: new Date(2024, 5, 15),
    invalid: new Date(2024, 5, 14),
    code: 'date_past',
  },
  minAge: {
    make: (o) => validators.minAge(18, o),
    valid: new Date(2006, 5, 15),
    invalid: new Date(2006, 5, 16),
    code: 'date_min_age',
  },
  maxAge: {
    make: (o) => validators.maxAge(65, o),
    valid: new Date(1959, 5, 15),
    invalid: new Date(1958, 5, 15),
    code: 'date_max_age',
  },
  maxFileSize: {
    make: (o) => validators.maxFileSize(100, o),
    valid: file('a.txt', 100),
    invalid: file('a.txt', 101),
    code: 'maxFileSize',
  },
  minFileSize: {
    make: (o) => validators.minFileSize(1, o),
    valid: file('a.txt', 1),
    invalid: file('a.txt', 0),
    code: 'minFileSize',
  },
  fileType: {
    make: (o) => validators.fileType('.pdf', o),
    valid: { name: 'a.pdf' },
    invalid: { name: 'a.txt' },
    code: 'fileType',
  },
  maxFiles: {
    make: (o) => validators.maxFiles(1, o),
    valid: [file('a', 1)],
    invalid: [file('a', 1), file('b', 1)],
    code: 'maxFiles',
  },
  minFiles: {
    make: (o) => validators.minFiles(2, o),
    valid: [file('a', 1), file('b', 1)],
    invalid: [file('a', 1)],
    code: 'minFiles',
  },
  maxTotalFileSize: {
    make: (o) => validators.maxTotalFileSize(100, o),
    valid: [file('a', 50), file('b', 50)],
    invalid: [file('a', 60), file('b', 50)],
    code: 'maxTotalFileSize',
  },
};

const ROWS = Object.entries(TABLE) as [RuleName, ContractRow][];

const run = (rule: AnyRule, value: unknown): ValidationIssue | null =>
  (rule as (value: unknown) => ValidationIssue | null)(value);

const EMPTY_VALUES: readonly (readonly [string, unknown])[] = [
  ['null', null],
  ['undefined', undefined],
  ["''", ''],
];

beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
afterEach(() => vi.useRealTimers());

describe('validators — полнота таблицы контракта', () => {
  it('таблица перечисляет все экспорты validators/index.ts, кроме утилит файлов', () => {
    expect(Object.keys(validators).sort()).toEqual([...Object.keys(TABLE), ...UTILITIES].sort());
  });

  it('все экспорты — функции', () => {
    const notFunctions = Object.entries(validators)
      .filter(([, value]) => typeof value !== 'function')
      .map(([name]) => name);
    expect(notFunctions).toEqual([]);
  });
});

describe('validators — пустые значения дают null (кроме required)', () => {
  // `''` у min и isNumber давал замечание — [ReFormer-qkxl], [ReFormer-a4tk].
  for (const [name, row] of ROWS) {
    if (name === 'required') continue;
    for (const [label, value] of EMPTY_VALUES) {
      it(`${name}: ${label} → null`, () => {
        expect(run(row.make(), value)).toBeNull();
      });
    }
  }

  it.each(EMPTY_VALUES)('required: %s → { code: required }', (_label, value) => {
    expect(run(TABLE.required.make(), value)).toEqual({ code: 'required' });
  });
});

describe.each(ROWS)('validators — контракт замечания: %s', (_name, row) => {
  it('допустимое значение проходит, недопустимое даёт встроенный код', () => {
    const rule = row.make();
    expect([run(rule, row.valid), run(rule, row.invalid)?.code]).toEqual([null, row.code]);
  });

  it('{ code } подменяет код', () => {
    expect(run(row.make({ code: 'x.y' }), row.invalid)?.code).toBe('x.y');
  });

  it('{ params } сливаются с параметрами правила, из опций — главнее', () => {
    const own = run(row.make(), row.invalid)?.params ?? {};
    const clash = Object.keys(own)[0];
    const user = { 'contract.extra': 1, ...(clash === undefined ? {} : { [clash]: 'из опций' }) };
    expect(run(row.make({ params: user }), row.invalid)?.params).toEqual({ ...own, ...user });
  });

  it('у замечания нет текста и severity — только code и params', () => {
    const plain = run(row.make(), row.invalid);
    const withOptions = run(row.make({ code: 'x.y', params: { hint: 1 } }), row.invalid);
    const extraKeys = [plain, withOptions].flatMap((issue) =>
      Object.keys(issue ?? {}).filter((key) => key !== 'code' && key !== 'params')
    );
    expect(extraKeys).toEqual([]);
  });

  it('повторный вызов на том же значении даёт тот же результат', () => {
    const rule = row.make();
    const round = () => [run(rule, row.valid), run(rule, row.invalid)];
    const first = round();
    expect([round(), round()]).toEqual([first, first]);
  });

  it('не мутирует проверяемое значение', () => {
    const snapshot = structuredClone(row.invalid);
    run(row.make(), row.invalid);
    expect(row.invalid).toEqual(snapshot);
  });
});
