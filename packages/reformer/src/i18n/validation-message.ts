/**
 * Текст замечания валидации.
 *
 * Замечание несёт только `code` и `params`; человеческую строку собирает резолвер. Порядок:
 *
 * 1. словарь формы — запись по коду ({@link IssueMessages}): текст конкретного поля;
 * 2. `validation.<code>` из словаря активной локали;
 * 3. `validation.<code>` из встроенной английской таблицы ядра;
 * 4. сам `code` — для своих кодов, которых нет ни в одном словаре.
 *
 * Текст получается при отображении, а не при проверке, поэтому смена языка переводит уже
 * показанные замечания без повторной валидации.
 *
 * @module i18n/validation-message
 */

import type { ValidationIssue } from '../form/types/contracts';
import coreEn from './en.json';
import { hasOwn } from './locale';
import type { MessageValues } from './message-format';
import { formatMessage, type I18nHandle } from './translator';

/**
 * Текст замечания в словаре формы: шаблон с параметрами либо функция.
 *
 * Шаблон — тот же формат сообщений, что в словарях локали: `{minLength}`, `plural`, `select`.
 * Параметры в него приходят подготовленными: дата — по языку, массив — перечнем, размер файла —
 * строкой с единицей. Число шаблон печатает как есть, без разрядов: «50 000 ₽» пишут готовым
 * текстом либо функцией, которая форматирует число сама.
 *
 * @example
 * ```ts
 * const byTemplate: IssueMessage = 'Не меньше {minLength} символов';
 * const byFunction: IssueMessage = (params, i18n) => `Не меньше ${i18n.number(Number(params.min))} ₽`;
 * ```
 */
export type IssueMessage =
  | string
  | ((params: Readonly<Record<string, unknown>>, i18n: I18nHandle) => string);

/**
 * Словарь формы: код замечания → текст. Ключ — `code` замечания: встроенный (`required`) либо
 * свой (`loanAmount.required`).
 */
export type IssueMessages = Readonly<Record<string, IssueMessage>>;

/**
 * Объявить словарь формы. Возвращает аргумент как есть — функция нужна типам: коды остаются
 * литералами, а значения проверяются как {@link IssueMessage}.
 *
 * @example
 * ```ts
 * export const loanMessages = defineIssueMessages({
 *   'loanAmount.required': 'Укажите сумму кредита',
 *   'loanPurpose.minLength': 'Минимум {minLength} символов',
 *   'carYear.max': (params) => `Не позднее ${String(params.max)}`,
 * });
 * ```
 */
export function defineIssueMessages<const Messages extends IssueMessages>(
  messages: Messages
): Messages {
  return messages;
}

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
  params: ValidationIssue['params'],
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
 * Отображаемый текст замечания валидации. Порядок источников — в шапке модуля.
 *
 * @param issue - Замечание от правила: `code` и `params`.
 * @param i18n - Ручка активной локали (`createI18n` / `useI18n`).
 * @param messages - Словарь формы; его записи важнее словаря локали.
 *
 * @example
 * ```ts
 * resolveIssueMessage({ code: 'minLength', params: { minLength: 8 } }, i18n);
 * // 'Enter at least 8 characters' · в русской локали — 'Не меньше 8 символов'
 *
 * resolveIssueMessage({ code: 'phone.required' }, i18n, { 'phone.required': 'Укажите телефон' });
 * // 'Укажите телефон' — текст поля из словаря формы
 * ```
 */
export function resolveIssueMessage(
  issue: ValidationIssue,
  i18n: I18nHandle,
  messages?: IssueMessages
): string {
  if (messages !== undefined && hasOwn(messages, issue.code)) {
    const own = messages[issue.code];
    if (typeof own === 'function') return own(issue.params ?? {}, i18n);
    // Битый шаблон формы не должен прятать ошибку поля: идём дальше, к локали и коду.
    const formatted = formatMessage(
      messages,
      i18n.code,
      issue.code,
      prepareParams(issue.params, i18n)
    );
    if (formatted !== undefined) return formatted;
  }

  const key = `validation.${issue.code}`;
  if (i18n.has(key) || hasOwn(coreEn, key)) {
    return i18n.t(key, prepareParams(issue.params, i18n));
  }
  return issue.code;
}
