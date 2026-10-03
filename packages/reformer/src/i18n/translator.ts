/**
 * Переводчик: ключ и значения → готовая строка по локали.
 *
 * Здесь живут две политики промаха, и они разные намеренно:
 *
 * - **ключ пакета** (`kit.*`, `cdk.*`, `validation.*`, `format.*`) — у пакета есть встроенная
 *   английская таблица, поэтому промах по локали и битое сообщение откатываются на неё.
 *   См. {@link translateBuiltin};
 * - **ключ приложения** — встроенной таблицы нет: промах откатывается на `defaultMessage`, а без
 *   него на сам ключ. См. {@link I18nHandle.t}.
 *
 * Маркера вида `⟦key⟧` нет ни в одном случае: форма стоит перед конечным пользователем, а
 * неполный словарь, пришедший по сети, — законный сценарий. Диагностика уходит в консоль, и только
 * вне production.
 *
 * @module i18n/translator
 */

import coreEn from './en.json';
import { hasOwn, type FormLocale, type Messages } from './locale';
import {
  formatPattern,
  parseMessage,
  type MessageFormatOptions,
  type MessagePattern,
  type MessageValues,
} from './message-format';

/** Язык встроенных таблиц пакетов и текстов `defaultMessage`. */
const BUILTIN_CODE = 'en';

/**
 * Пропущенный аргумент виден как `{name}`: форма не падает, а автор словаря узнаёт подстановку,
 * которую забыл передать.
 */
const FORMAT_OPTIONS: MessageFormatOptions = { onMissingArgument: (name) => `{${name}}` };

/** `null` — сообщение не разобралось; повторно его не разбираем и не ругаемся. */
const patternCache = new WeakMap<Messages, Map<string, MessagePattern | null>>();
const defaultPatternCache = new Map<string, MessagePattern | null>();
const warnedMissing = new WeakMap<Messages, Set<string>>();

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function parseOrNull(source: unknown, where: string): MessagePattern | null {
  try {
    // Словарь мог прийти по сети: значение не обязано быть строкой.
    if (typeof source !== 'string') throw new TypeError('сообщение не является строкой');
    return parseMessage(source);
  } catch (error) {
    if (isDev()) {
      console.error(
        `[@reformer/core/i18n] ${where}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return null;
  }
}

/** Разобранное сообщение словаря: `undefined` — ключа нет, `null` — сообщение битое. */
function patternOf(
  messages: Messages,
  key: string,
  code: string
): MessagePattern | null | undefined {
  if (!hasOwn(messages, key)) return undefined;
  let cache = patternCache.get(messages);
  if (cache === undefined) patternCache.set(messages, (cache = new Map()));
  let pattern = cache.get(key);
  if (pattern === undefined) {
    pattern = parseOrNull(messages[key], `локаль «${code}», ключ «${key}»`);
    cache.set(key, pattern);
  }
  return pattern;
}

/** Сообщение словаря по правилам его языка; `undefined`, если ключа нет или сообщение битое. */
function formatFrom(
  messages: Messages,
  code: string,
  key: string,
  values: MessageValues | undefined
): string | undefined {
  const pattern = patternOf(messages, key, code);
  if (pattern === undefined || pattern === null) return undefined;
  return formatPattern(pattern, values ?? {}, code, FORMAT_OPTIONS);
}

/**
 * Перевод ключа пакета: словарь локали, затем встроенная английская таблица пакета, затем сам
 * ключ. Английская таблица форматируется по английским правилам — её множественные формы и
 * группировка чисел не зависят от активного языка.
 *
 * @param locale - Активная локаль.
 * @param builtin - Встроенная английская таблица пакета-владельца ключа.
 * @param key - Ключ сообщения.
 * @param values - Значения подстановок.
 */
export function translateBuiltin(
  locale: FormLocale,
  builtin: Messages,
  key: string,
  values?: MessageValues
): string {
  return (
    formatFrom(locale.messages, locale.code, key, values) ??
    formatFrom(builtin, BUILTIN_CODE, key, values) ??
    key
  );
}

function formatDefault(source: string, values: MessageValues | undefined): string | undefined {
  let pattern = defaultPatternCache.get(source);
  if (pattern === undefined) {
    pattern = parseOrNull(source, `defaultMessage «${source}»`);
    defaultPatternCache.set(source, pattern);
  }
  return pattern === null
    ? undefined
    : formatPattern(pattern, values ?? {}, BUILTIN_CODE, FORMAT_OPTIONS);
}

/** Ручка локали: перевод и форматирование по одному языку. */
export interface I18nHandle {
  /** Локаль, по которой работает ручка. */
  readonly locale: FormLocale;
  /** Код языка — то же, что `locale.code`. */
  readonly code: string;
  /** Есть ли ключ в словаре локали (встроенные английские таблицы не учитываются). */
  has(key: string): boolean;
  /**
   * Перевод ключа приложения: словарь локали → `defaultMessage` → встроенная таблица ядра → ключ.
   *
   * @param key - Ключ сообщения.
   * @param values - Значения подстановок.
   * @param defaultMessage - Английский текст на случай, если ключа в локали нет.
   */
  t(key: string, values?: MessageValues, defaultMessage?: string): string;
  /** Число по правилам языка. */
  number(value: number, options?: Intl.NumberFormatOptions): string;
  /** Дата по правилам языка. */
  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  /** Размер файла: `1536` → `1.5 KB` (`1,5 КБ` в русской локали). База — 1024. */
  fileSize(bytes: number): string;
}

const FILE_SIZE_UNITS = ['b', 'kb', 'mb', 'gb', 'tb'] as const;

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function cached<T>(
  cache: Map<string, T>,
  code: string,
  options: object | undefined,
  make: () => T
): T {
  const id = options === undefined ? code : `${code}|${JSON.stringify(options)}`;
  let format = cache.get(id);
  if (format === undefined) cache.set(id, (format = make()));
  return format;
}

const handles = new WeakMap<FormLocale, I18nHandle>();

/**
 * Ручка для локали. Для одного и того же объекта локали возвращается один и тот же объект —
 * ручку можно держать в зависимостях хуков.
 *
 * @param locale - Локаль; см. {@link FormLocale}.
 *
 * @example
 * ```ts
 * const i18n = createI18n({ code: 'ru', messages: { 'cart.items': '{count, plural, one{# товар} few{# товара} other{# товаров}}' } });
 * i18n.t('cart.items', { count: 3 });  // '3 товара'
 * i18n.fileSize(1536);                 // '1,5 КБ'
 * ```
 */
export function createI18n(locale: FormLocale): I18nHandle {
  const existing = handles.get(locale);
  if (existing !== undefined) return existing;

  const { code, messages } = locale;

  const number: I18nHandle['number'] = (value, options) =>
    cached(numberFormats, code, options, () => new Intl.NumberFormat(code, options)).format(value);

  const t: I18nHandle['t'] = (key, values, defaultMessage) => {
    const own = formatFrom(messages, code, key, values);
    if (own !== undefined) return own;
    if (defaultMessage !== undefined) {
      const fallback = formatDefault(defaultMessage, values);
      if (fallback !== undefined) return fallback;
    }
    const builtin = formatFrom(coreEn, BUILTIN_CODE, key, values);
    if (builtin !== undefined) return builtin;

    // Ключ уходит на экран как есть — единственный случай, о котором стоит сказать автору.
    if (isDev()) {
      let warned = warnedMissing.get(messages);
      if (warned === undefined) warnedMissing.set(messages, (warned = new Set()));
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(
          `[@reformer/core/i18n] ключа «${key}» нет в локали «${code}», и defaultMessage не задан — показан сам ключ`
        );
      }
    }
    return key;
  };

  const handle: I18nHandle = {
    locale,
    code,
    has: (key) => hasOwn(messages, key),
    t,
    number,
    date: (value, options) =>
      cached(dateFormats, code, options, () => new Intl.DateTimeFormat(code, options)).format(
        value
      ),
    fileSize: (bytes) => {
      if (!Number.isFinite(bytes) || bytes < 0) return '';
      let size = bytes;
      let unit = 0;
      while (size >= 1024 && unit < FILE_SIZE_UNITS.length - 1) {
        size /= 1024;
        unit += 1;
      }
      // Группировка разрядов в размере файла только мешает: «1,023 B» читается как дробь.
      const value = number(size, { maximumFractionDigits: unit === 0 ? 0 : 1, useGrouping: false });
      return t(`format.fileSize.${FILE_SIZE_UNITS[unit]}`, { value });
    },
  };
  handles.set(locale, handle);
  return handle;
}
