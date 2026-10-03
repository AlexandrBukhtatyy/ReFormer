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
 */
import { describe, expect, it } from 'vitest';
import { IntlMessageFormat } from 'intl-messageformat';
import { createMessageFormatter, type MessageValues } from '../../src/i18n/message-format';

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
