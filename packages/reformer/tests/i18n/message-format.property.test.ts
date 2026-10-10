/**
 * Свойства формата сообщений ядра (`src/i18n/message-format.ts`) — fast-check.
 *
 * 1. **Сверка с эталоном на порождённых сообщениях.** Докстринг модуля обещает: сообщение из
 *    поддержанного подмножества ICU `intl-messageformat` (режим `ignoreTag`, все значения заданы)
 *    выводит посимвольно так же. `message-format.differential.test.ts` проверяет это на
 *    фиксированном наборе; здесь тот же приём на случайных деревьях: текст с экранированием
 *    апострофом, `{arg}`, `plural` с `#` и ветками категорий и `=N`, `select`, вложенность до трёх
 *    уровней, пробелы и переводы строк внутри скобок; языки `en`, `ru`, `pl`.
 * 2. **Экранирование обратимо.** Любой текст, экранированный по правилу ICU, выводится
 *    посимвольно — и ядром, и эталоном; незакрытый в конце сообщения литерал тянется до конца.
 * 3. **Разбор не падает чужим исключением.** Произвольная строка либо разбирается, либо даёт
 *    `MessageSyntaxError` — никогда `TypeError`/`RangeError`; разобранное сообщение форматируется
 *    без исключений при любых примитивных значениях, в том числе пропущенных и не тех типов.
 * 4. **Что разбирает ядро, разбирает и эталон, и выводят они одинаково** — грубая сверка на
 *    «супе» из служебных кусков, где встречаются и странные сочетания, до которых генератор дерева
 *    не дойдёт. Обратное не требуется: грамматика ядра уже.
 *
 * Бывшие расхождения генераторы больше не обходят: апостроф перед `<`/`>` [ReFormer-l53m], `#`
 * внутри `select`, вложенного в `plural` [ReFormer-6bit], ключи и имена, которые эталон отвергает
 * [ReFormer-d8i3, ReFormer-eh7o], пробелы ICU вне `\s` (U+0085). Значение `plural` — конечное
 * число: на прочих ядро намеренно ставит маркер, а эталон выбирает ветку.
 *
 * Воспроизведение упавшего случая: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 */
import fc from 'fast-check';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { messageArguments } from '../../src/i18n/locale';
import {
  createMessageFormatter,
  formatPattern,
  MessageSyntaxError,
  parseMessage,
  type MessagePattern,
  type MessageValues,
} from '../../src/i18n/message-format';
import { propertyParams } from '../test-utils/property';

const LOCALES = ['en', 'ru', 'pl'] as const;

/** Эталон — как в дифференциальном тесте: режим `ignoreTag`, все значения заданы. */
const reference = (message: string, values: MessageValues, locale: string): string =>
  String(new IntlMessageFormat(message, locale, undefined, { ignoreTag: true }).format(values));

// ── Порождённые сообщения: дерево и его исходный текст ─────────────────────────────────────────

/** Где стоит текст: от этого зависит, какие символы в нём служебные. */
interface Place {
  /**
   * Прямо в ветке `plural`: `#` — число, литеральная решётка экранируется. Во вложенном `select`
   * решётка — обычный текст [ReFormer-6bit].
   */
  readonly inPlural: boolean;
}

const TOP: Place = { inPlural: false };

type Branch = readonly [key: string, body: readonly GenNode[]];

/** Узел порождённого сообщения; `pad` — пробелы в местах, где их допускает синтаксис. */
type GenNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'arg'; readonly name: string; readonly pad: readonly string[] }
  | { readonly kind: 'pound' }
  | {
      readonly kind: 'plural' | 'select';
      readonly name: string;
      readonly branches: readonly Branch[];
      readonly pad: readonly string[];
    };

// Имена аргументов разведены по видам узлов: у каждого имени значение своего типа.
const ARG_NAMES = ['a', 'b'] as const;
const PLURAL_NAMES = ['n', 'count'] as const;
const SELECT_NAMES = ['g', 'kind'] as const;
/** Ключи веток, кроме обязательной `other`: категории CLDR и `=N` — целое, в том числе со знаком. */
const PLURAL_KEYS = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  '=0',
  '=1',
  '=2',
  '=5',
  '=21',
  '=-1',
  '=+3',
];
const SELECT_KEYS = ['male', 'female', 'yes', 'a', '1', '2'];

/**
 * Обычные символы текста. Угловые скобки — текст (`ignoreTag`), но одиночный апостроф перед ними
 * открыл бы литерал, как перед `{` [ReFormer-l53m], — генератор его удваивает.
 */
const PLAIN_CHARS = [...'aZжЁ7 ,.!-=|<>"', '\n'];
/**
 * Пробелы в синтаксисе — набор ICU (Pattern_White_Space), в том числе U+0085 и U+2028: первого нет
 * в JS-овском `\s` [ReFormer-eh7o].
 */
const padArb = fc.array(fc.constantFrom('', '', ' ', '  ', '\n', '\t', '\r\n', '\u0085', ' '), {
  minLength: 7,
  maxLength: 7,
});

/** Символ, перед которым одиночный апостроф остаётся апострофом и в ядре, и в эталоне. */
const plainAfterApostrophe = (ch: string | undefined): boolean =>
  ch !== undefined && !"'{}#<>|".includes(ch);

/**
 * Текст в исходник сообщения по правилу ICU: с первого служебного символа (`{`, `}`, а в ветке
 * `plural` и `#`) до конца текста — литерал в апострофах; апостроф и внутри, и снаружи удваивается.
 *
 * @param lone - Одиночный апостроф перед обычным символом оставить как есть (`don't`).
 * @param close - Закрыть литерал; незакрытый тянется до конца сообщения.
 */
function escapeText(value: string, inPlural: boolean, lone = false, close = true): string {
  let at = 0;
  while (at < value.length && !['{', '}', ...(inPlural ? ['#'] : [])].includes(value[at]!)) at++;
  const head = value.slice(0, at);
  const tail = value.slice(at);
  let out = '';
  for (let i = 0; i < head.length; i++) {
    const ch = head[i]!;
    if (ch !== "'") out += ch;
    else out += lone && plainAfterApostrophe(head[i + 1]) ? "'" : "''";
  }
  if (tail !== '') out += `'${tail.replace(/'/g, "''")}${close ? "'" : ''}`;
  return out;
}

/** Дерево в исходник: соседние тексты склеиваются до экранирования. */
function serialize(nodes: readonly GenNode[], place: Place, lone: boolean): string {
  let out = '';
  let text = '';
  const flush = (): void => {
    out += escapeText(text, place.inPlural, lone);
    text = '';
  };
  for (const node of nodes) {
    if (node.kind === 'text') {
      text += node.value;
      continue;
    }
    flush();
    if (node.kind === 'pound') out += '#';
    else if (node.kind === 'arg') out += `{${node.pad[0]}${node.name}${node.pad[1]}}`;
    else {
      const [p0, p1, p2, p3, p4, p5, p6] = node.pad;
      const inner = innerPlace(node.kind);
      const branches = node.branches
        .map(([key, body]) => `${key}${p5}{${serialize(body, inner, lone)}}${p6}`)
        .join('');
      out += `{${p0}${node.name}${p1},${p2}${node.kind}${p3},${p4}${branches}}`;
    }
  }
  flush();
  return out;
}

const innerPlace = (kind: 'plural' | 'select'): Place => ({ inPlural: kind === 'plural' });

const textArb: fc.Arbitrary<GenNode> = fc
  .array(
    fc.oneof(
      fc.constantFrom(...PLAIN_CHARS, "'", "'", '{', '}', '#'),
      fc.string({ unit: 'grapheme', maxLength: 2 })
    ),
    { minLength: 1, maxLength: 8 }
  )
  .map((parts): GenNode => ({ kind: 'text', value: parts.join('') }));

const argArb: fc.Arbitrary<GenNode> = fc
  .record({ name: fc.constantFrom(...ARG_NAMES), pad: padArb })
  .map(({ name, pad }): GenNode => ({ kind: 'arg', name, pad }));

const patternArbs = new Map<string, fc.Arbitrary<readonly GenNode[]>>();

/** Последовательность узлов для места `place`; `depth` — сколько ещё можно уровней plural/select. */
function patternArb(place: Place, depth: number): fc.Arbitrary<readonly GenNode[]> {
  const id = `${depth}|${place.inPlural}`;
  let arb = patternArbs.get(id);
  if (arb === undefined) {
    const kinds = [textArb, argArb];
    if (place.inPlural) kinds.push(fc.constant<GenNode>({ kind: 'pound' }));
    if (depth > 0) kinds.push(branchingArb('plural', depth - 1));
    if (depth > 0) kinds.push(branchingArb('select', depth - 1));
    arb = fc.array(fc.oneof(...kinds), { maxLength: 4 });
    patternArbs.set(id, arb);
  }
  return arb;
}

function branchingArb(kind: 'plural' | 'select', depth: number) {
  const body = patternArb(innerPlace(kind), depth);
  return fc
    .record({
      name: fc.constantFrom(...(kind === 'plural' ? PLURAL_NAMES : SELECT_NAMES)),
      // Ключи уникальны — дубль ключа отвергают и эталон, и ядро [ReFormer-d8i3].
      keys: fc.uniqueArray(fc.constantFrom(...(kind === 'plural' ? PLURAL_KEYS : SELECT_KEYS)), {
        maxLength: 3,
      }),
      otherAt: fc.nat({ max: 3 }),
      pad: padArb,
    })
    .chain(({ name, keys, otherAt, pad }) => {
      const all = [...keys];
      all.splice(Math.min(otherAt, all.length), 0, 'other');
      return fc.array(body, { minLength: all.length, maxLength: all.length }).map(
        (bodies): GenNode => ({
          kind,
          name,
          pad,
          branches: all.map((key, i): Branch => [key, bodies[i]!]),
        })
      );
    });
}

const treeArb = fc.record({ nodes: patternArb(TOP, 3), lone: fc.boolean() });

/** Сообщение из поддержанного подмножества ICU — сразу исходным текстом. */
const messageArb = treeArb.map(({ nodes, lone }) => serialize(nodes, TOP, lone));

/** Признаки дерева — для проверки самого генератора: виды узлов, вложенность, служебные символы. */
function features(nodes: readonly GenNode[], parent: string, seen: Set<string>): void {
  for (const node of nodes) {
    seen.add(node.kind);
    if (node.kind === 'text') {
      for (const ch of ["'", '{', '}', '#']) if (node.value.includes(ch)) seen.add(`text ${ch}`);
    } else if (node.kind === 'plural' || node.kind === 'select') {
      seen.add(`${parent} > ${node.kind}`);
      for (const [key, body] of node.branches) {
        if (key.startsWith('=')) seen.add('=N');
        features(body, node.kind, seen);
      }
    }
  }
}

const argValueArb = fc.oneof(
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.integer(),
  fc.double()
);
const pluralValueArb = fc.oneof(
  fc.constantFrom(0, 1, 2, 3, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 1234, 1e6, -1, -0, 0.5, 1.5),
  fc.integer({ min: -2000, max: 2_000_000 }),
  fc.double({ min: -1e9, max: 1e9, noNaN: true })
);
const selectValueArb = fc.oneof(
  fc.constantFrom(...SELECT_KEYS, 'other', 'zzz', ''),
  // Эталон ищет ветку `select` обычным индексом объекта: имя из прототипа там — не промах.
  fc.string().filter((value) => !(value in Object.prototype)),
  fc.constantFrom(1, 2)
);
const valuesArb = fc.record({
  a: argValueArb,
  b: argValueArb,
  n: pluralValueArb,
  count: pluralValueArb,
  g: selectValueArb,
  kind: selectValueArb,
});

// ── Произвольные строки ───────────────────────────────────────────────────────────────────────

/** Служебные куски «супа»: из них чаще складываются почти правильные сообщения. */
const SOUP_TOKENS = [
  ...`{},#' nagxж`,
  '\n',
  "''",
  ...['plural', 'select', 'other', 'one', 'few', '=1', '=0'],
];
/** Суп для сверки с эталоном: ASCII-куски и служебные токены. */
const soupArb = fc
  .array(fc.oneof(fc.constantFrom(...SOUP_TOKENS), fc.string({ maxLength: 3 })), { maxLength: 40 })
  .map((parts) => parts.join(''));
/** Суп для разбора — ещё и символы, на которых ядро расходится с эталоном, и любые code point. */
const roughSoupArb = fc
  .array(
    fc.oneof(
      fc.constantFrom(...SOUP_TOKENS, '<', '>', '.', '-', '=abc', '\u00A0', '\u2028', '\uFEFF'),
      fc.string({ unit: 'binary', maxLength: 3 })
    ),
    { maxLength: 40 }
  )
  .map((parts) => parts.join(''));

const primitiveArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.bigInt()
);

/** Разобранное сообщение или `null`, если ядро его отвергло. */
const tryParse = (source: string): MessagePattern | null => {
  try {
    return parseMessage(source);
  } catch {
    return null;
  }
};

describe('message-format — свойства: сверка с intl-messageformat', () => {
  it('генератор порождает все виды узлов, вложенность и экранирование', () => {
    const trees = fc.sample(treeArb, { numRuns: 300, seed: 7 });
    const seen = new Set<string>();
    for (const { nodes } of trees) features(nodes, 'top', seen);
    const sources = trees.map(({ nodes, lone }) => serialize(nodes, TOP, lone)).join('\n');

    expect([...seen]).toEqual(
      expect.arrayContaining([
        'text',
        'arg',
        'pound',
        'top > plural',
        'top > select',
        'plural > plural',
        'plural > select',
        'select > plural',
        'select > select',
        '=N',
        "text '",
        'text {',
        'text }',
        'text #',
      ])
    );
    expect(sources).toMatch(/''/); // удвоенный апостроф
    expect(sources).toMatch(/'[{}]/); // литерал скобки
    expect(sources).toMatch(/'#/); // литерал решётки в ветке plural
    expect(sources).toMatch(/[^']'[^'{}#<>|]/); // одиночный апостроф перед обычным символом
  });

  it('порождённое сообщение ядро разбирает и выводит посимвольно как эталон', () => {
    fc.assert(
      fc.property(messageArb, valuesArb, fc.constantFrom(...LOCALES), (message, values, locale) => {
        expect(createMessageFormatter(locale)(message, values)).toBe(
          reference(message, values, locale)
        );
      }),
      propertyParams(200)
    );
  });

  it('экранированный по правилу ICU текст выводится посимвольно — ядром и эталоном', () => {
    const literalArb = fc
      .array(
        fc.oneof(
          fc.constantFrom("'", "''", '{', '}', '#', '<', '>', ' ', "'{'"),
          fc.string({ unit: 'grapheme', maxLength: 4 })
        ),
        { maxLength: 10 }
      )
      .map((parts) => parts.join(''));

    fc.assert(
      fc.property(
        literalArb,
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (text, inPlural, lone, close) => {
          // Незакрытый литерал возможен только в конце сообщения — значит, вне ветки.
          const escaped = escapeText(text, inPlural, lone, close || inPlural);
          const message = inPlural ? `{n, plural, other{${escaped}}}` : escaped;
          const values = { n: 1 };

          expect(createMessageFormatter('ru')(message, values)).toBe(text);
          expect(reference(message, values, 'ru')).toBe(text);
        }
      ),
      propertyParams(300)
    );
  });

  it('строку, которую разбирает ядро, эталон тоже разбирает и выводит так же', () => {
    fc.assert(
      fc.property(soupArb, fc.constantFrom(...LOCALES), (source, locale) => {
        const pattern = tryParse(source);
        if (pattern === null) return; // грамматика ядра уже — отказ ядра ничего не доказывает
        // Числа годятся и plural, и select, и подстановке; эталону нужны все значения.
        const values = Object.fromEntries(
          [...messageArguments(pattern)].map((name, i) => [name, i + 1])
        );
        // Отказ эталона здесь — нарушение «честного подмножества» [ReFormer-d8i3, ReFormer-eh7o].
        expect(formatPattern(pattern, values, locale)).toBe(reference(source, values, locale));
      }),
      propertyParams(500)
    );
  });
});

describe('message-format — свойства: устойчивость разбора и форматирования', () => {
  it('произвольная строка разбирается либо даёт MessageSyntaxError — иных исключений нет', () => {
    fc.assert(
      fc.property(
        fc.oneof(roughSoupArb, fc.string(), fc.string({ unit: 'binary' }), messageArb),
        (source) => {
          try {
            parseMessage(source);
          } catch (error) {
            expect(error).toBeInstanceOf(MessageSyntaxError);
          }
        }
      ),
      propertyParams(500)
    );
  });

  it('разобранное сообщение форматируется без исключений при любых примитивных значениях', () => {
    fc.assert(
      fc.property(
        fc.oneof(messageArb, roughSoupArb),
        fc.array(primitiveArb, { minLength: 1, maxLength: 6 }),
        fc.constantFrom(...LOCALES),
        fc.boolean(),
        (source, pool, locale, customMissing) => {
          const pattern = tryParse(source);
          if (pattern === null) return;
          const values = Object.fromEntries(
            [...messageArguments(pattern)].map((name, i) => [name, pool[i % pool.length]])
          );
          const options = customMissing ? { onMissingArgument: (name: string) => `<${name}>` } : {};

          const text = formatPattern(pattern, values, locale, options);

          expect(typeof text).toBe('string');
          // Кэш разбора форматтера даёт то же, что разбор заново.
          expect(createMessageFormatter(locale, options)(source, values)).toBe(text);
        }
      ),
      propertyParams(300)
    );
  });
});
