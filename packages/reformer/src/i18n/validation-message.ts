/**
 * Текст ошибки валидации по активной локали.
 *
 * Правила каталога несут только `code` и `params`; человеческую строку собирает резолвер. Порядок:
 *
 * 1. `error.messageKey` — если такой ключ есть в локали (локализуемый текст автора правила);
 * 2. непустое `error.message` — явное сообщение автора правила;
 * 3. `validation.<code>` из словаря локали;
 * 4. `validation.<code>` из встроенной английской таблицы ядра;
 * 5. сам `error.code` — для своих кодов, которых нет ни в одном словаре.
 *
 * Текст получается при отображении, а не при проверке, поэтому смена языка переводит уже
 * показанные ошибки без повторной валидации.
 *
 * @module i18n/validation-message
 */

import type { ValidationError } from '../form/types/contracts';
import coreEn from './en.json';
import { hasOwn } from './locale';
import type { MessageValues } from './message-format';
import type { I18nHandle } from './translator';

/**
 * Умолчание `message` у правил до того, как им стало `''`. Считается пустым: резолвер обязан
 * работать и с ошибками от более старого ядра или стороннего правила, написанного по образцу.
 */
const LEGACY_DEFAULT_MESSAGE = 'invalid';

/** Параметры-размеры в байтах: в сообщение идут строкой вида «5 МБ». */
const SIZE_PARAMS = new Set([
  'maxFileSize',
  'minFileSize',
  'actualSize',
  'maxTotalFileSize',
  'actualTotal',
]);

const listFormats = new Map<string, Intl.ListFormat | null>();

/** Перечень через запятую по правилам языка; без `Intl.ListFormat` — простое соединение. */
function formatList(code: string, items: readonly unknown[]): string {
  const strings = items.map(String);
  let format = listFormats.get(code);
  if (format === undefined) {
    try {
      format = new Intl.ListFormat(code, { style: 'short', type: 'unit' });
    } catch {
      format = null;
    }
    listFormats.set(code, format);
  }
  return format === null ? strings.join(', ') : format.format(strings);
}

/**
 * Готовит параметры ошибки к подстановке в сообщение: дата — по языку, массив — перечнем,
 * размер в байтах — строкой с единицей. Числа остаются числами, иначе не сработал бы `plural`.
 */
function prepareParams(
  params: ValidationError['params'],
  i18n: I18nHandle
): MessageValues | undefined {
  if (params === undefined) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    const value: unknown = params[key];
    if (value instanceof Date) out[key] = i18n.date(value, { dateStyle: 'medium' });
    else if (Array.isArray(value)) out[key] = formatList(i18n.code, value);
    else if (typeof value === 'number' && SIZE_PARAMS.has(key)) out[key] = i18n.fileSize(value);
    else out[key] = value;
  }
  return out;
}

/**
 * Отображаемый текст ошибки валидации. Порядок источников — в шапке модуля.
 *
 * @param error - Ошибка от правила: `code`, `message`, `messageKey`, `params`.
 * @param i18n - Ручка активной локали (`createI18n` / `useI18n`).
 *
 * @example
 * ```ts
 * resolveValidationError({ code: 'minLength', message: '', params: { minLength: 8 } }, i18n);
 * // 'Enter at least 8 characters' · в русской локали — 'Не меньше 8 символов'
 *
 * resolveValidationError({ code: 'required', message: 'Укажите телефон' }, i18n);
 * // 'Укажите телефон' — явное сообщение автора важнее словаря
 * ```
 */
export function resolveValidationError(error: ValidationError, i18n: I18nHandle): string {
  if (error.messageKey !== undefined && i18n.has(error.messageKey)) {
    return i18n.t(error.messageKey, prepareParams(error.params, i18n));
  }
  // Проверка типа — для ошибок из JS-кода и чужих правил, где `message` могли не задать вовсе.
  if (
    typeof error.message === 'string' &&
    error.message !== '' &&
    error.message !== LEGACY_DEFAULT_MESSAGE
  ) {
    return error.message;
  }

  const key = `validation.${error.code}`;
  if (i18n.has(key) || hasOwn(coreEn, key)) {
    return i18n.t(key, prepareParams(error.params, i18n));
  }
  return error.code;
}
