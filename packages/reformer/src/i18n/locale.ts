/**
 * Объект локали — чистые данные.
 *
 * Локаль намеренно не несёт функций и не привязана к сборке: её можно положить JSON-файлом на
 * сервер, получить по сети и передать провайдеру как есть. Всё, что зависит от языка, выводится из
 * двух вещей: кода языка (для `Intl`) и плоского словаря сообщений в формате ICU.
 *
 * @module i18n/locale
 */

import { parseMessage, type MessagePattern } from './message-format';

/** Плоский словарь: ключ → сообщение в формате ICU (см. `message-format.ts`). */
export type Messages = Readonly<Record<string, string>>;

/** День недели, с которого начинается календарь: `0` — воскресенье, `1` — понедельник. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Локаль формы.
 *
 * @example
 * ```ts
 * const ru: FormLocale = {
 *   code: 'ru',
 *   weekStartsOn: 1,
 *   messages: { 'kit.select.selected': 'Выбрано: {count}' },
 * };
 * ```
 */
export interface FormLocale {
  /** Код языка BCP 47 (`en`, `ru`, `pt-BR`): по нему работают `Intl` и множественные формы. */
  readonly code: string;
  /** Словарь сообщений. Ключа нет — пакет подставит встроенный английский. */
  readonly messages: Messages;
  /** Первый день недели календаря. По умолчанию — воскресенье. */
  readonly weekStartsOn?: WeekStart;
  /**
   * Необязательное переопределение: объект локали `react-day-picker` / `date-fns`. Для ядра
   * непрозрачен. Без него даты форматируются через `Intl` по {@link FormLocale.code}.
   */
  readonly dateLocale?: unknown;
  /** Необязательное переопределение: формат даты в токенах `date-fns` для DatePicker. */
  readonly dateFormat?: string;
}

/**
 * Локаль «провайдера нет»: английский, пустой словарь. Каждый пакет при промахе по словарю берёт
 * свою встроенную английскую таблицу, поэтому пустой словарь означает «всё по-английски».
 */
export const DEFAULT_LOCALE: FormLocale = Object.freeze({
  code: 'en',
  messages: Object.freeze({}),
});

/**
 * Новая локаль на основе существующей: словари сливаются (ключи из `patch` важнее), остальные
 * поля заменяются. Исходный объект не меняется.
 *
 * @param base - Локаль-основа, например поставляемая китом.
 * @param patch - Свои ключи, переопределения китовых подписей и поля локали.
 *
 * @example
 * ```ts
 * import { ru } from '@reformer/ui-kit/locale/ru';
 *
 * const appRu = extendLocale(ru, {
 *   messages: { 'profile.title': 'Профиль', 'kit.formWizard.submit': 'Отправить' },
 * });
 * ```
 */
export function extendLocale(base: FormLocale, patch: Partial<FormLocale>): FormLocale {
  const { messages, ...rest } = patch;
  return {
    ...base,
    ...rest,
    messages: messages === undefined ? base.messages : { ...base.messages, ...messages },
  };
}

/** `Object.hasOwn` без требования ES2022 к рантайму потребителя. */
export function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/** Что не так со словарём. */
export interface LocaleIssue {
  readonly key: string;
  /**
   * - `syntax` — сообщение не разбирается;
   * - `missing` — ключ есть в образце, но его нет в словаре;
   * - `extra` — ключа нет в образце;
   * - `arguments` — набор подстановок не совпадает с образцом.
   */
  readonly kind: 'syntax' | 'missing' | 'extra' | 'arguments';
  readonly message: string;
}

/**
 * Имена аргументов сообщения, включая те, что встречаются только внутри веток `plural`/`select`.
 *
 * @param pattern - Результат `parseMessage`.
 */
export function messageArguments(
  pattern: MessagePattern,
  out: Set<string> = new Set()
): Set<string> {
  for (const node of pattern) {
    if (node.kind === 'text') continue;
    out.add(node.name);
    if (node.kind === 'plural' || node.kind === 'select') {
      for (const branch of node.branches.values()) messageArguments(branch, out);
    }
  }
  return out;
}

/**
 * Проверяет словарь: каждое сообщение разбирается, а при заданном образце — набор ключей и имена
 * подстановок совпадают с ним. Нужна там, где компилятор не поможет: словарь пришёл по сети или
 * написан вне репозитория. В рантайме вызывать не обязательно — битое или пропущенное сообщение
 * и так откатится на встроенный английский; проверка нужна тестам и CI.
 *
 * @param messages - Проверяемый словарь.
 * @param reference - Образец, обычно английский словарь того же пакета.
 * @returns Список расхождений; пустой — словарь в порядке.
 *
 * @example
 * ```ts
 * expect(validateLocale(ruJson, enJson)).toEqual([]);
 * ```
 */
export function validateLocale(messages: Messages, reference?: Messages): LocaleIssue[] {
  const issues: LocaleIssue[] = [];
  const parsed = new Map<string, MessagePattern>();

  for (const [key, source] of Object.entries(messages)) {
    try {
      parsed.set(key, parseMessage(source));
    } catch (error) {
      issues.push({
        key,
        kind: 'syntax',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (reference === undefined) return issues;

  for (const key of Object.keys(messages)) {
    if (!hasOwn(reference, key)) {
      issues.push({ key, kind: 'extra', message: 'ключа нет в образце' });
    }
  }
  for (const [key, source] of Object.entries(reference)) {
    if (!hasOwn(messages, key)) {
      issues.push({ key, kind: 'missing', message: 'ключ есть в образце, но не переведён' });
      continue;
    }
    const own = parsed.get(key);
    if (own === undefined) continue; // синтаксис уже записан выше
    const expected = [...messageArguments(parseMessage(source))].sort().join(', ');
    const actual = [...messageArguments(own)].sort().join(', ');
    if (expected !== actual) {
      issues.push({
        key,
        kind: 'arguments',
        message: `образец ждёт {${expected}}, словарь — {${actual}}`,
      });
    }
  }
  return issues;
}
