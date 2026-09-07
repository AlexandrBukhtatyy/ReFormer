/**
 * Формат сообщений интерфейса — подмножество ICU MessageFormat без зависимостей.
 *
 * Поддерживает ровно то, что нужно интерфейсу билдера, и ничего сверх:
 * - **подстановка** — `Открыт файл {name}`;
 * - **множественные формы** — `{count, plural, one{# файл} few{# файла} many{# файлов} other{# файла}}`,
 *   категории берутся из {@link Intl.PluralRules} активной локали, `#` подставляет само число через
 *   {@link Intl.NumberFormat};
 * - **выбор по значению** — `{gender, select, male{он} female{она} other{оно}}`;
 * - **экранирование** — апострофом, как в ICU: `'{'` → `{`, `'}'` → `}`, `''` → `'`.
 *
 * Три свойства, ради которых формат устроен именно так:
 *
 * 1. **Сообщение разбирается в дерево, а не форматируется заменами по строке.** Значение аргумента
 *    попадает в результат как текст и повторно не разбирается: `{name}` со значением
 *    `{count, plural, ...}` выведет эти символы, а не выполнит их. Замена регулярным выражением
 *    такой гарантии не даёт.
 * 2. **Синтаксис — честное подмножество ICU.** Любое сообщение, которое понимает этот модуль,
 *    `intl-messageformat` понимает так же и выводит посимвольно то же самое; это проверено
 *    дифференциальным тестом на общем наборе сообщений. Отсюда страховка из контракта: если
 *    подмножества перестанет хватать, библиотека подставляется под тот же вызов, и словари
 *    переписывать не придётся.
 * 3. **Ошибка синтаксиса и отсутствие ветки `other` — отказ на разборе**, а не молчаливая
 *    неправильная строка в интерфейсе. Разбор словаря на старте и в CI ловит их до пользователя.
 *
 * Отличий от `intl-messageformat` в выводе нет; отличий два, и оба — сужение, а не расхождение:
 * - **Грамматика уже.** Типы аргументов `number`, `date`, `time`, `selectordinal` не поддержаны и
 *   отвергаются на разборе. Сообщение с ними не пройдёт в словарь, а не отформатируется молча
 *   неправильно. Заметь: голое `{n}` форматируется как `String(n)` и здесь, и в `intl-messageformat`
 *   (`{year}` → `2026`, а не `2 026`); по локали форматируется только `#` внутри `plural`.
 * - **Пропущенный аргумент не бросает исключение**, а подставляет заметный маркер `⟦name⟧`: строка
 *   интерфейса не должна ронять панель. Поведение настраивается через `onMissingArgument`.
 *
 * @module shell/platform/services/i18n/message-format
 */

/** Узел разобранного сообщения. */
export type MessageNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'arg'; readonly name: string }
  | { readonly kind: 'number'; readonly name: string }
  | { readonly kind: 'plural'; readonly name: string; readonly branches: MessageBranches }
  | { readonly kind: 'select'; readonly name: string; readonly branches: MessageBranches };

/** Разобранное сообщение — плоская последовательность узлов. */
export type MessagePattern = readonly MessageNode[];

/** Ветки `plural`/`select`: категория CLDR (`one`, `few`, …), точное совпадение (`=0`) или значение `select`. */
export type MessageBranches = ReadonlyMap<string, MessagePattern>;

/** Значения аргументов сообщения. */
export type MessageValues = Readonly<Record<string, unknown>>;

/** Настройки форматирования. */
export interface MessageFormatOptions {
  /**
   * Что подставить вместо аргумента, которого нет в значениях (или чьё значение не число там, где
   * ожидалось число). По умолчанию — заметный маркер `⟦name⟧`, тот же приём, что и для пропущенного
   * ключа: пропуск должен попадаться разработчику, а не пользователю.
   */
  readonly onMissingArgument?: (name: string) => string;
}

/** Отказ разбора сообщения: синтаксис или отсутствие обязательной ветки `other`. */
export class MessageSyntaxError extends Error {
  override readonly name = 'MessageSyntaxError';
}

/** Маркер пропущенного аргумента по умолчанию — математические скобки, в тексте интерфейса не встречаются. */
const DEFAULT_MISSING = (name: string): string => `⟦${name}⟧`;

const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

/**
 * Разбирает сообщение в дерево. Бросает {@link MessageSyntaxError} на ошибке синтаксиса и на
 * `plural`/`select` без ветки `other`.
 *
 * @param source - Текст сообщения из словаря.
 * @returns Разобранное сообщение для {@link formatPattern}.
 *
 * @example
 * ```ts
 * parseMessage('{count, plural, one{# файл} few{# файла} many{# файлов} other{# файла}}');
 * ```
 */
export function parseMessage(source: string): MessagePattern {
  let pos = 0;

  // Аннотация типа обязательна: без неё TypeScript не считает вызов `fail(...)` завершающим поток
  // и не сужает тип после проверок ниже.
  const fail: (what: string) => never = (what) => {
    throw new MessageSyntaxError(`${what} (позиция ${pos}) в сообщении: ${source}`);
  };

  /** Символ, который апострофу есть смысл экранировать. `#` — только внутри `plural`, как в ICU. */
  const isSyntax = (ch: string | undefined, inPlural: boolean): boolean =>
    ch === '{' || ch === '}' || (inPlural && ch === '#');

  const skipSpace = (): void => {
    while (pos < source.length && /\s/.test(source[pos]!)) pos++;
  };

  /** Имя аргумента или ключ ветки — всё до пробела и служебного символа. */
  const readName = (): string => {
    const start = pos;
    while (pos < source.length && !/[\s,{}#]/.test(source[pos]!)) pos++;
    if (pos === start) fail('ожидалось имя');
    return source.slice(start, pos);
  };

  /** Апостроф: `''` → `'`; `'` перед служебным символом открывает литерал до следующего `'`. */
  const readQuoted = (inPlural: boolean): string => {
    pos++;
    if (source[pos] === "'") {
      pos++;
      return "'";
    }
    if (!isSyntax(source[pos], inPlural)) return "'";
    let out = '';
    while (pos < source.length) {
      if (source[pos] !== "'") out += source[pos++];
      else if (source[pos + 1] === "'") {
        out += "'";
        pos += 2;
      } else {
        pos++;
        return out;
      }
    }
    return out;
  };

  /**
   * Читает текст до `}` (внутри ветки) или до конца строки.
   * `pluralArg` — имя аргумента ближайшего `plural`, к которому относится `#`; `null` вне `plural`.
   */
  const parsePattern = (nested: boolean, pluralArg: string | null): MessagePattern => {
    const nodes: MessageNode[] = [];
    let text = '';
    const flush = (): void => {
      if (text !== '') {
        nodes.push({ kind: 'text', value: text });
        text = '';
      }
    };
    while (pos < source.length) {
      const ch = source[pos]!;
      if (ch === '}') {
        if (!nested) fail("непарная «}» — литерал пишется как '}'");
        break;
      }
      if (ch === "'") text += readQuoted(pluralArg !== null);
      else if (ch === '#' && pluralArg !== null) {
        pos++;
        flush();
        nodes.push({ kind: 'number', name: pluralArg });
      } else if (ch === '{') {
        flush();
        nodes.push(parseArgument(pluralArg));
      } else {
        text += ch;
        pos++;
      }
    }
    flush();
    return nodes;
  };

  /** Читает ветки `key{…}` до закрывающей `}` аргумента. */
  const parseBranches = (
    owner: string,
    type: string,
    pluralArg: string | null
  ): MessageBranches => {
    const branches = new Map<string, MessagePattern>();
    skipSpace();
    while (pos < source.length && source[pos] !== '}') {
      const key = readName();
      skipSpace();
      if (source[pos] !== '{') fail(`ожидалась «{» после ветки «${key}»`);
      pos++;
      branches.set(key, parsePattern(true, pluralArg));
      if (source[pos] !== '}') fail(`ветка «${key}» не закрыта`);
      pos++;
      skipSpace();
    }
    if (source[pos] !== '}') fail(`«${owner}, ${type}» не закрыт «}»`);
    pos++;
    if (!branches.has('other')) fail(`в «${owner}, ${type}» нет обязательной ветки other`);
    return branches;
  };

  /** Читает `{name}`, `{name, plural, …}` или `{name, select, …}`; внутрь `select` `#` наследуется. */
  const parseArgument = (pluralArg: string | null): MessageNode => {
    pos++;
    skipSpace();
    const name = readName();
    skipSpace();
    if (source[pos] === '}') {
      pos++;
      return { kind: 'arg', name };
    }
    if (source[pos] !== ',') fail(`ожидались «,» или «}» после аргумента «${name}»`);
    pos++;
    skipSpace();
    const type = readName();
    if (type !== 'plural' && type !== 'select')
      fail(`неизвестный тип «${type}» у «${name}» — поддерживаются plural и select`);
    skipSpace();
    if (source[pos] !== ',') fail(`ожидалась «,» после «${type}»`);
    pos++;
    return {
      kind: type,
      name,
      branches: parseBranches(name, type, type === 'plural' ? name : pluralArg),
    };
  };

  return parsePattern(false, null);
}

/**
 * Собирает строку из разобранного сообщения. Значения подставляются как текст и повторно
 * не разбираются.
 *
 * @param pattern - Результат {@link parseMessage}.
 * @param values - Значения аргументов.
 * @param locale - Локаль для {@link Intl.PluralRules} и {@link Intl.NumberFormat} (`ru`, `en`, …).
 * @param options - Настройки; см. {@link MessageFormatOptions}.
 * @returns Готовая строка интерфейса.
 */
export function formatPattern(
  pattern: MessagePattern,
  values: MessageValues,
  locale: string,
  options: MessageFormatOptions = {}
): string {
  const onMissing = options.onMissingArgument ?? DEFAULT_MISSING;

  /** Число для `#` и для выбора формы; `null`, если аргумента нет или он не конечное число. */
  const asNumber = (name: string): number | null => {
    const raw = values[name];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  };

  const render = (nodes: MessagePattern): string => {
    let out = '';
    for (const node of nodes) {
      if (node.kind === 'text') out += node.value;
      else if (node.kind === 'arg')
        out += values[node.name] === undefined ? onMissing(node.name) : String(values[node.name]);
      else if (node.kind === 'number') {
        const n = asNumber(node.name);
        out += n === null ? onMissing(node.name) : numberFormat(locale).format(n);
      } else if (node.kind === 'plural') {
        const n = asNumber(node.name);
        out +=
          n === null
            ? onMissing(node.name)
            : render(
                node.branches.get(`=${n}`) ??
                  node.branches.get(pluralRules(locale).select(n)) ??
                  node.branches.get('other')!
              );
      } else {
        const raw = values[node.name];
        out +=
          raw === undefined
            ? onMissing(node.name)
            : render(node.branches.get(String(raw)) ?? node.branches.get('other')!);
      }
    }
    return out;
  };

  return render(pattern);
}

/** {@link Intl.PluralRules} локали, с кэшем: создание правил заметно дороже вызова `select`. */
function pluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (rules === undefined) pluralRulesCache.set(locale, (rules = new Intl.PluralRules(locale)));
  return rules;
}

/** {@link Intl.NumberFormat} локали, с кэшем — по той же причине. */
function numberFormat(locale: string): Intl.NumberFormat {
  let format = numberFormatCache.get(locale);
  if (format === undefined) numberFormatCache.set(locale, (format = new Intl.NumberFormat(locale)));
  return format;
}

/**
 * Форматтер одной локали с кэшем разбора: сообщение разбирается один раз, на первый вызов.
 * Это внутренность `I18nService.t()` — сам `t()` добавляет сверху поиск ключа в словаре, маркер
 * пропущенного ключа и откат на резервную локаль.
 *
 * @param locale - Локаль форматтера.
 * @param options - Настройки; см. {@link MessageFormatOptions}.
 * @returns Функция `(сообщение, значения) => строка`.
 *
 * @example
 * ```ts
 * const format = createMessageFormatter('ru');
 * format('{count, plural, one{# файл} few{# файла} many{# файлов} other{# файла}}', { count: 5 });
 * // '5 файлов'
 * ```
 */
export function createMessageFormatter(
  locale: string,
  options: MessageFormatOptions = {}
): (source: string, values?: MessageValues) => string {
  const cache = new Map<string, MessagePattern>();
  return (source, values = {}) => {
    let pattern = cache.get(source);
    if (pattern === undefined) cache.set(source, (pattern = parseMessage(source)));
    return formatPattern(pattern, values, locale, options);
  };
}
