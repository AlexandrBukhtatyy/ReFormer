/**
 * Свойства числовых и строковых правил на случайных значениях (fast-check).
 *
 * Эталон — задокументированная семантика, записанная независимо от кода правила: `min(t)` пропускает
 * `v ≥ t`, `minLength(n)` — длину не меньше `n`, `email` — «одна @, точка внутри домена, без
 * пробельных символов» и т.д. Общие свойства: пустые значения дают `null` при любом параметре
 * правила; любая строка кода подменяет код; `params` из опций сливаются и главнее; `pattern` с
 * флагом `/g` отвечает на чередующиеся вызовы так же, как `test()` без флага.
 *
 * Генераторы включают входы бывших дефектов: `''` и строки-числа для `min`/`max` ([ReFormer-qkxl]),
 * `±Infinity` и `''` для `isNumber` ([ReFormer-5v4x], [ReFormer-a4tk]), суммы до двадцати миллионов
 * для `multipleOf` ([ReFormer-csg2]). Воспроизведение:
 * `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { RuleOptions } from '../../../src/form/types/validation-schema';
import {
  email,
  fileType,
  futureDate,
  integer,
  isDate,
  isNumber,
  max,
  maxAge,
  maxDate,
  maxFiles,
  maxFileSize,
  maxLength,
  maxTotalFileSize,
  min,
  minAge,
  minDate,
  minFiles,
  minFileSize,
  minLength,
  multipleOf,
  nonNegative,
  nonZero,
  pastDate,
  pattern,
  phone,
  required,
  url,
} from '../../../src/form/validators';
import { propertyParams } from '../../test-utils/property';

type AnyRule = (value: never) => ValidationIssue | null;

const run = (rule: AnyRule, value: unknown): ValidationIssue | null =>
  (rule as (value: unknown) => ValidationIssue | null)(value);

/** Любое число: NaN, ±0, ±Infinity, субнормальные. */
const anyNumber = fc.double();
/** Порог правила — без NaN: порог NaN — вырожденная настройка, не вход пользователя. */
const threshold = fc.double({ noNaN: true });

describe('validators — числовые правила против эталонных предикатов', () => {
  it('min(t): проходят NaN и v ≥ t, иначе { min: t, actual: v }', () => {
    fc.assert(
      fc.property(threshold, anyNumber, (t, v) => {
        const expected =
          Number.isNaN(v) || v >= t ? null : { code: 'min', params: { min: t, actual: v } };
        expect(min(t)(v)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('max(t): проходят NaN и v ≤ t, иначе { max: t, actual: v }', () => {
    fc.assert(
      fc.property(threshold, anyNumber, (t, v) => {
        const expected =
          Number.isNaN(v) || v <= t ? null : { code: 'max', params: { max: t, actual: v } };
        expect(max(t)(v)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('min(t) и max(t): строка — не число, замечания нет при любом пороге [ReFormer-qkxl]', () => {
    const text = fc.oneof(fc.string(), fc.double().map(String));
    fc.assert(
      fc.property(threshold, text, (t, v) => {
        expect([min(t)(v as never), max(t)(v as never)]).toEqual([null, null]);
      }),
      propertyParams()
    );
  });

  it('integer: проходят NaN и целые, дробные и ±Infinity — замечание', () => {
    fc.assert(
      fc.property(anyNumber, (v) => {
        const expected = Number.isNaN(v) || Number.isInteger(v) ? null : { code: 'integer' };
        expect(integer()(v)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('nonNegative: проходят NaN и v ≥ 0 (включая -0)', () => {
    fc.assert(
      fc.property(anyNumber, (v) => {
        const expected = Number.isNaN(v) || v >= 0 ? null : { code: 'nonNegative' };
        expect(nonNegative()(v)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('nonZero: замечание ровно на 0 и -0', () => {
    fc.assert(
      fc.property(anyNumber, (v) => {
        const expected = v === 0 ? { code: 'nonZero' } : null;
        expect(nonZero()(v)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('isNumber: проходят пустые значения и конечные числа, остальное — замечание', () => {
    const input = fc.oneof(
      fc.double(), // с NaN и ±Infinity — [ReFormer-5v4x]
      fc.string(), // с '' — [ReFormer-a4tk]
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined),
      fc.array(fc.integer(), { maxLength: 2 }),
      fc.object({ maxDepth: 1 })
    );
    fc.assert(
      fc.property(input, (v) => {
        const empty = v === null || v === undefined || v === '';
        const finite = typeof v === 'number' && Number.isFinite(v);
        expect(isNumber()(v as never)).toEqual(empty || finite ? null : { code: 'isNumber' });
      }),
      propertyParams()
    );
  });

  it('multipleOf(d), двоично-точный шаг: k·d проходит, k·d + d/2 — нет', () => {
    const step = fc.constantFrom(0.125, 0.25, 0.5, 1, 2, 5, 10, 25);
    fc.assert(
      fc.property(step, fc.integer({ min: -1_000_000, max: 1_000_000 }), (d, k) => {
        const results = [multipleOf(d)(k * d), multipleOf(d)(k * d + d / 2)?.code];
        expect(results).toEqual([null, 'multipleOf']);
      }),
      propertyParams()
    );
  });

  it('multipleOf(d), десятичный шаг: кратное, введённое как десятичная запись, проходит', () => {
    // Значения до двадцати миллионов: абсолютный допуск 1e-9 давал там ложные ошибки [ReFormer-csg2].
    const step = fc.constantFrom<readonly [number, number]>(
      [0.1, 1],
      [0.2, 1],
      [0.05, 2],
      [0.01, 2]
    );
    const multiplier = fc.integer({ min: -2_000_000_000, max: 2_000_000_000 });
    fc.assert(
      fc.property(step, multiplier, ([d, digits], k) => {
        const multiple = Number((k * d).toFixed(digits));
        const between = Number((k * d + d / 2).toFixed(digits + 1));
        const results = [multipleOf(d)(multiple), multipleOf(d)(between)?.code];
        expect(results).toEqual([null, 'multipleOf']);
      }),
      propertyParams()
    );
  });
});

describe('validators — правила длины против эталона', () => {
  const lengthLimit = fc.nat({ max: 12 });
  const text = fc.string({ unit: 'binary', maxLength: 16 });
  const list = fc.array(fc.anything(), { maxLength: 8 });

  it('minLength(n) на строках: пустая строка или length ≥ n проходят', () => {
    fc.assert(
      fc.property(lengthLimit, text, (n, s) => {
        const expected =
          s === '' || s.length >= n
            ? null
            : { code: 'minLength', params: { minLength: n, actualLength: s.length } };
        expect(minLength(n)(s)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('maxLength(n) на строках: пустая строка или length ≤ n проходят', () => {
    fc.assert(
      fc.property(lengthLimit, text, (n, s) => {
        const expected =
          s === '' || s.length <= n
            ? null
            : { code: 'maxLength', params: { maxLength: n, actualLength: s.length } };
        expect(maxLength(n)(s)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('minLength / maxLength на массивах: считается число элементов, [] не пропускается', () => {
    fc.assert(
      fc.property(lengthLimit, list, (n, items) => {
        const actualLength = items.length;
        // У массива — коды элементов (`minItems` / `maxItems`), а не символов; параметры прежние.
        expect([minLength(n)(items), maxLength(n)(items)]).toEqual([
          actualLength >= n ? null : { code: 'minItems', params: { minLength: n, actualLength } },
          actualLength <= n ? null : { code: 'maxItems', params: { maxLength: n, actualLength } },
        ]);
      }),
      propertyParams()
    );
  });
});

describe('validators — строковые правила против эталона', () => {
  /** Эталон email: одна @ не в начале, в домене есть точка не с краю, нет пробельных символов. */
  const looksLikeEmail = (s: string): boolean => {
    if (/\s/.test(s)) return false;
    const at = s.indexOf('@');
    if (at <= 0 || at !== s.lastIndexOf('@')) return false;
    const domain = s.slice(at + 1);
    for (let i = 1; i < domain.length - 1; i++) if (domain[i] === '.') return true;
    return false;
  };

  it('email: результат совпадает с эталоном на почти-адресах', () => {
    const symbol = fc.constantFrom('a', 'b', 'я', '.', '@', '+', '-', ' ', '\t', ' ');
    const part = fc.string({ unit: fc.constantFrom('a', 'b', 'я', '.', '-'), maxLength: 4 });
    const address = fc.oneof(
      fc.string({ unit: symbol, maxLength: 14 }),
      fc.tuple(part, part, part).map(([local, host, zone]) => `${local}@${host}.${zone}`)
    );
    fc.assert(
      fc.property(address, (s) => {
        const expected = s === '' || looksLikeEmail(s) ? null : { code: 'email' };
        expect(email()(s)).toEqual(expected);
      }),
      propertyParams()
    );
  });

  it('pattern с флагом /g: на чередующихся вызовах ответ совпадает с test() без флага', () => {
    const source = fc.constantFrom('a', '^a+$', 'ab', '\\d', '^\\d+$', 'b$');
    const inputs = fc.array(fc.string({ unit: fc.constantFrom('a', 'b', '1'), maxLength: 4 }), {
      minLength: 1,
      maxLength: 8,
    });
    fc.assert(
      fc.property(source, inputs, (src, values) => {
        const rule = pattern(new RegExp(src, 'g'));
        const reference = new RegExp(src);
        expect(values.map((s) => rule(s)?.code ?? null)).toEqual(
          values.map((s) => (s === '' || reference.test(s) ? null : 'pattern'))
        );
      }),
      propertyParams()
    );
  });
});

describe('validators — общие свойства опций и пустых значений', () => {
  /** Все фабрики, кроме required, с числовым параметром (игнорируется, если параметра нет). */
  const FACTORIES: Readonly<Record<string, (n: number) => AnyRule>> = {
    min: (n) => min(n),
    max: (n) => max(n),
    minLength: (n) => minLength(n),
    maxLength: (n) => maxLength(n),
    email: () => email(),
    pattern: () => pattern(/^x$/g),
    url: () => url({ requireProtocol: true }),
    phone: () => phone({ format: 'ru' }),
    isNumber: () => isNumber(),
    integer: () => integer(),
    multipleOf: (n) => multipleOf(n),
    nonNegative: () => nonNegative(),
    nonZero: () => nonZero(),
    isDate: () => isDate(),
    minDate: (n) => minDate(new Date(n)),
    maxDate: (n) => maxDate(new Date(n)),
    pastDate: () => pastDate(),
    futureDate: () => futureDate(),
    minAge: (n) => minAge(n),
    maxAge: (n) => maxAge(n),
    maxFileSize: (n) => maxFileSize(n),
    minFileSize: (n) => minFileSize(n),
    fileType: () => fileType('.pdf'),
    maxFiles: (n) => maxFiles(n),
    minFiles: (n) => minFiles(n),
    maxTotalFileSize: (n) => maxTotalFileSize(n),
  };
  it('пустые значения дают null при любом параметре правила', () => {
    const empty = fc.constantFrom<readonly [string, unknown]>(
      ['null', null],
      ['undefined', undefined],
      ["''", '']
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(FACTORIES)),
        fc.double(),
        empty,
        (name, n, [, value]) => {
          expect(run(FACTORIES[name](n), value)).toBeNull();
        }
      ),
      propertyParams()
    );
  });

  /** Представители всех форм параметров замечания: без params, числа, строки, Date, массивы. */
  const INVALID: readonly (readonly [string, (options: RuleOptions) => AnyRule, unknown])[] = [
    ['required', (o) => required(o), null],
    ['min', (o) => min(10, o), 5],
    ['minLength', (o) => minLength(3, o), 'ab'],
    ['email', (o) => email(o), 'x'],
    ['url_protocol', (o) => url({ ...o, allowedProtocols: ['https'] }), 'http://example.com'],
    ['phone', (o) => phone({ ...o, format: 'ru' }), 'abc'],
    ['isDate', (o) => isDate(o), 'not-a-date'],
    ['minDate', (o) => minDate(new Date(2024, 0, 10), o), new Date(2024, 0, 9)],
    ['maxFiles', (o) => maxFiles(1, o), [{ name: 'a' }, { name: 'b' }]],
    ['fileType', (o) => fileType('.pdf', o), { name: 'a.txt' }],
  ];

  it('любая строка кода подменяет код, параметры правила сохраняются', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INVALID),
        fc.string({ unit: 'binary' }),
        ([, make, value], code) => {
          const own = run(make({}), value);
          const expected = own?.params === undefined ? { code } : { code, params: own.params };
          expect(run(make({ code }), value)).toEqual(expected);
        }
      ),
      propertyParams()
    );
  });

  it('params из опций сливаются с параметрами правила, из опций — главнее', () => {
    const key = fc.constantFrom(
      'min',
      'actual',
      'minLength',
      'allowedProtocols',
      'format',
      'minDate',
      'maxFiles',
      'accept',
      'fileName',
      'hint',
      'x'
    );
    const userParams = fc.dictionary(key, fc.jsonValue(), { maxKeys: 4, noNullPrototype: true });
    fc.assert(
      fc.property(fc.constantFrom(...INVALID), userParams, ([, make, value], user) => {
        const own = run(make({}), value)?.params;
        const expected = own === undefined ? user : { ...own, ...user };
        expect(run(make({ params: user }), value)?.params).toEqual(expected);
      }),
      propertyParams()
    );
  });
});
