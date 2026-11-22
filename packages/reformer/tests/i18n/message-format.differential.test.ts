/**
 * Дифференциальный тест форматтера против `intl-messageformat`.
 *
 * Докстринг `message-format.ts` обещает: любое сообщение, которое понимает наш модуль, эталонная
 * библиотека понимает так же и выводит посимвольно то же самое. Здесь это обещание проверяется на
 * общем наборе сообщений, значений и языков.
 *
 * Границы сравнения — ровно те, что названы в докстринге:
 * - эталон работает в режиме `ignoreTag`: у нас `<b>` — обычный текст, а не разметка;
 * - значения — строки и числа, и все они заданы: на пропущенном аргументе эталон бросает
 *   исключение, а наш модуль подставляет маркер (это отличие намеренное и покрыто соседним тестом).
 *
 * В конце файла — бывшие расхождения: сообщения, которые наш модуль понимал иначе, чем эталон,
 * или принимал, хотя эталон их отвергает. Каждое исправлено и закреплено тестом с меткой задачи;
 * генераторы `message-format.property.test.ts` их больше не обходят.
 */
import { describe, expect, it } from 'vitest';
import { IntlMessageFormat } from 'intl-messageformat';
import {
  createMessageFormatter,
  parseMessage,
  type MessageValues,
} from '../../src/i18n/message-format';

const LOCALES = ['en', 'ru', 'pl', 'ar', 'ja'] as const;

const reference = (message: string, values: MessageValues, locale: string): string =>
  String(new IntlMessageFormat(message, locale, undefined, { ignoreTag: true }).format(values));

/** Сообщение и наборы значений, на которых оно сравнивается. */
const CORPUS: ReadonlyArray<readonly [string, ReadonlyArray<MessageValues>]> = [
  // ── текст без аргументов
  ['', [{}]],
  ['Панель файлов', [{}]],
  ['Selected: all', [{}]],
  ['Текст с <b>разметкой</b> и a < b > c', [{}]],
  ['тег # вне plural остаётся решёткой', [{}]],

  // ── подстановка
  [
    'Открыт файл {name}',
    [{ name: 'form.ts' }, { name: '' }, { name: '{count, plural, other{X}}' }],
  ],
  ['{a} и ещё раз {a}', [{ a: 'X' }]],
  ['Привет, {  name  }!', [{ name: 'мир' }]],
  ['{year} год', [{ year: 2026 }, { year: 0 }, { year: -5 }, { year: 1234567 }, { year: 1.5 }]],
  ['Step {current} of {total} • {percent}% complete', [{ current: 2, total: 3, percent: 66 }]],

  // ── множественные формы
  [
    '{count, plural, one{# файл} few{# файла} many{# файлов} other{# файла}}',
    [0, 1, 2, 5, 11, 21, 22, 25, 101, 111, 1234, 1.5, -1].map((count) => ({ count })),
  ],
  [
    '{count, plural, one{# file} other{# files}}',
    [0, 1, 2, 11, 1234, 1000000].map((count) => ({ count })),
  ],
  [
    '{count, plural, =0{файлов нет} =1{один файл} one{# файл} few{# файла} many{# файлов} other{# файла}}',
    [0, 1, 2, 5, 21].map((count) => ({ count })),
  ],
  ['{count, plural, one {# item} other {# items}}', [1, 2].map((count) => ({ count }))],
  [
    '{count, plural, zero{ноль} one{один} two{два} few{несколько} many{много} other{прочее}}',
    [0, 1, 2, 3, 6, 11, 100].map((count) => ({ count })),
  ],
  ['Selected: {count, plural, other{#}}', [{ count: 3 }]],

  // ── выбор по значению
  [
    '{gender, select, male{он} female{она} other{оно}}',
    [{ gender: 'male' }, { gender: 'female' }, { gender: 'robot' }, { gender: '' }],
  ],
  ['{n, select, 1{один} 2{два} other{много}}', [{ n: 1 }, { n: 2 }, { n: 3 }]],

  // ── вложенность
  [
    '{count, plural, one{# файл в {dir}} few{# файла в {dir}} many{# файлов в {dir}} other{# файла в {dir}}}',
    [
      { count: 1, dir: 'src' },
      { count: 3, dir: 'src' },
      { count: 7, dir: 'src' },
    ],
  ],
  [
    '{count, plural, one{{gender, select, female{удалила} other{удалил}} # файл} other{{gender, select, female{удалила} other{удалил}} # файлов}}',
    [
      { count: 1, gender: 'female' },
      { count: 5, gender: 'male' },
    ],
  ],
  ['{a, plural, other{#: {b, plural, other{#}}}}', [{ a: 2, b: 9 }]],
  [
    '{kind, select, file{{count, plural, one{# файл} other{# файлов}}} other{ничего}}',
    [
      { kind: 'file', count: 1 },
      { kind: 'file', count: 5 },
      { kind: 'dir', count: 5 },
    ],
  ],

  // ── экранирование
  ["Ключ '{'name'}' не найден", [{}]],
  ["it''s fine", [{}]],
  ["don't {a}", [{ a: 'x' }]],
  ["{count, plural, other{'#' #}}", [{ count: 3 }]],
  ["тег '#' здесь", [{}]],
  ["{count, plural, other{'{'#'}'}}", [{ count: 3 }]],
  ["'{'{a}'}'", [{ a: 'x' }]],
  ["конец с апострофом'", [{}]],
  ["a '<b>' c и '>' d", [{}]], // [ReFormer-l53m]

  // ── бывшие расхождения: «#» во вложенном select, «=N» со знаком
  ['{n, plural, other{{g, select, other{# шт.}}}}', [{ n: 3, g: 'x' }]], // [ReFormer-6bit]
  ['{n, plural, =-1{минус один} =+1{не выберется} other{#}}', [{ n: -1 }, { n: 1 }]],
];

describe('message-format ≡ intl-messageformat на общем наборе', () => {
  for (const locale of LOCALES) {
    const format = createMessageFormatter(locale);
    it(`язык «${locale}»`, () => {
      const mismatches: string[] = [];
      for (const [message, valueSets] of CORPUS) {
        for (const values of valueSets) {
          const expected = reference(message, values, locale);
          const actual = format(message, values);
          if (actual !== expected) {
            mismatches.push(
              `${JSON.stringify(message)} ${JSON.stringify(values)}: эталон ${JSON.stringify(expected)}, у нас ${JSON.stringify(actual)}`
            );
          }
        }
      }
      expect(mismatches).toEqual([]);
    });
  }

  it('набор не пуст и покрывает все виды узлов', () => {
    const all = CORPUS.map(([message]) => message).join('\n');
    expect(CORPUS.length).toBeGreaterThan(25);
    expect(all).toMatch(/plural/);
    expect(all).toMatch(/select/);
    expect(all).toMatch(/'\{'/);
  });
});

/** Разбирает ли сообщение наш модуль. */
const parses = (message: string): boolean => {
  try {
    parseMessage(message);
    return true;
  } catch {
    return false;
  }
};

/** Разбирает ли сообщение эталон. */
const referenceParses = (message: string): boolean => {
  try {
    new IntlMessageFormat(message, 'en', undefined, { ignoreTag: true });
    return true;
  } catch {
    return false;
  }
};

/** Ключи веток, которые эталон отвергает, а наш модуль раньше принимал. */
const KEYS_REJECTED_BY_REFERENCE = [
  '{n, plural, one{А} one{Б} other{В}}', // дубль ключа — у нас побеждал последний
  '{g, select, a{А} a{Б} other{В}}',
  '{n, plural, =abc{А} other{Б}}', // после «=» не целое число — у нас была ветка, которая не выберется
  '{n, plural, =1.5{А} other{Б}}',
  '{n, plural, =99999999999999999999{А} other{Б}}', // не безопасное целое
  '{g, select, =1{А} other{Б}}', // «=N» бывает только у plural
];

/** Имена и пробелы, которые эталон отвергает, а наш модуль раньше принимал. */
const NAMES_REJECTED_BY_REFERENCE = [
  '{user.name}', // символы синтаксиса ICU (Pattern_Syntax) в имени аргумента
  '{first-name}',
  "{a'b}",
  '{g, select, a.b{А} other{Б}}', // …и в ключе ветки
  '{\u00A0name}', // неразрывный пробел — пробел для JS (\s), но не для ICU (Pattern_White_Space)
  '{n, plural, other{x}\u00A0}',
];

describe('message-format ≡ intl-messageformat — бывшие расхождения', () => {
  const ru = createMessageFormatter('ru');

  it('апостроф перед «<» и «>» открывает литерал, как в эталоне [ReFormer-l53m]', () => {
    // Эталон: `'<` и `'>` экранируют угловые скобки и в режиме ignoreTag.
    expect(ru("a '<b>' c")).toBe('a <b> c');
  });

  it('«#» внутри select, вложенного в plural, — литерал, как в эталоне и ICU [ReFormer-6bit]', () => {
    // Эталон и ICU подставляют число только на верхнем уровне ветки plural.
    expect(ru('{n, plural, other{{g, select, other{# шт.}}}}', { n: 3, g: 'x' })).toBe('# шт.');
  });

  it('эталон эти ключи, имена и пробелы отвергает', () => {
    expect(
      [...KEYS_REJECTED_BY_REFERENCE, ...NAMES_REJECTED_BY_REFERENCE].filter(referenceParses)
    ).toEqual([]);
  });

  it('ключи веток, которые эталон отвергает, — отказ разбора [ReFormer-d8i3]', () => {
    expect(KEYS_REJECTED_BY_REFERENCE.filter(parses)).toEqual([]);
  });

  it('имена с символами синтаксиса ICU и пробелы не из ICU — отказ разбора [ReFormer-eh7o]', () => {
    expect(NAMES_REJECTED_BY_REFERENCE.filter(parses)).toEqual([]);
  });

  it('имена, ключи и пробелы, которые эталон принимает, принимаем и мы', () => {
    const accepted = [
      '{имя}',
      '{first_name}',
      '{n, plural, =0{А} =-1{Б} =+2{В} other{Г}}',
      '{g, select, a_b{А} other{Б}}',
      '{ n , plural , one {А} other {Б} }',
      '{n,plural,other{x}}',
      '{n, plural,\r\n\tother{x} }',
    ];
    expect([accepted.filter(referenceParses), accepted.filter(parses)]).toEqual([
      accepted,
      accepted,
    ]);
  });

  it('предел вложенности: 100 уровней разбираются, 101 — отказ разбора [ReFormer-9jow]', () => {
    const nested = (depth: number): string =>
      '{a, select, other{'.repeat(depth - 1) + '{a}' + '}}'.repeat(depth - 1);
    expect([parses(nested(100)), parses(nested(101)), referenceParses(nested(101))]).toEqual([
      true,
      false,
      true,
    ]);
  });
});
