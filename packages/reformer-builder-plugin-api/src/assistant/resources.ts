/**
 * Ресурсы ассистента от плагинов — что плагин даёт модели ПРОЧИТАТЬ.
 *
 * ## Два пути к модели
 *
 * - **Модель читает сама.** Строка {@link AssistantResourceProvider.describe} каждого провайдера
 *   уходит в затравку хода, и модель читает ресурс встроенным инструментом ассистента
 *   (`read_resource`) по адресу. Сам инструмент появляется, только когда есть хоть один провайдер.
 * - **Прикрепляет человек.** Пикер в чате ищет по провайдерам ({@link AssistantResourceProvider.search}),
 *   а другой плагин может прикрепить ресурс командой {@link ASSISTANT_ATTACH_COMMAND_ID} — например,
 *   пунктом контекстного меню. Содержимое прикреплённого уходит вместе с репликой.
 *
 * ## Адрес и схема
 *
 * Адрес ресурса — `<схема>:<остаток>`. Схема принадлежит ОДНОМУ провайдеру: по ней ассистент
 * выбирает, кого спросить. Второй провайдер той же схемы отвергается — молча делить адреса
 * значило бы, что модель читает не то, что видела в каталоге.
 *
 * Содержимое ресурса — данные, а не инструкции: ассистент так его и подаёт модели.
 *
 * @module @reformer/builder-plugin-api/assistant/resources
 */

import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';
import type { AssistantError } from './tools.js';

/** Предел длины строки {@link AssistantResourceProvider.describe} (символы). */
export const ASSISTANT_RESOURCE_DESCRIBE_MAX = 200;

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]{0,19}$/;

/** Годится ли строка в схему: строчные буквы, цифры, `+ . -`, с буквы, до 20 символов. */
export function isAssistantResourceScheme(scheme: string): boolean {
  return SCHEME_PATTERN.test(scheme);
}

/**
 * Разобрать адрес на схему и остаток: `source:forms/a.json` → `{ scheme: 'source', rest: 'forms/a.json' }`.
 * Остаток может быть пустым (`source:` — корень). `null` — у строки нет годной схемы.
 */
export function parseAssistantResourceUri(
  uri: string
): { readonly scheme: string; readonly rest: string } | null {
  const at = uri.indexOf(':');
  if (at <= 0) return null;
  const scheme = uri.slice(0, at);
  return isAssistantResourceScheme(scheme) ? { scheme, rest: uri.slice(at + 1) } : null;
}

/** Найденный ресурс — строка пикера. */
export interface AssistantResourceEntry {
  readonly uri: string;
  /** Короткое имя для чипа вложения: обычно имя файла. */
  readonly name: string;
  /** Уточнение для строки пикера: обычно путь. */
  readonly description?: string;
}

/** Прочитанный ресурс: целиком — листать его по страницам будет ассистент. */
export type AssistantResourceRead =
  | { readonly ok: true; readonly text: string; readonly mediaType: string }
  | { readonly ok: false; readonly error: AssistantError };

/** Провайдер ресурсов одной схемы. */
export interface AssistantResourceProvider {
  /** Схема адресов, см. {@link isAssistantResourceScheme}. */
  readonly scheme: string;
  /**
   * ОДНА строка для модели, по-английски: как выглядят адреса и что за ними.
   * Не длиннее {@link ASSISTANT_RESOURCE_DESCRIBE_MAX} — она уходит в затравку каждого хода.
   */
  readonly describe: string;
  /** Поиск для пикера. Без него ресурсы провайдера пикер не показывает. */
  search?(query: string, signal: AbortSignal): Promise<readonly AssistantResourceEntry[]>;
  /** Прочитать ресурс по адресу своей схемы. */
  read(uri: string, signal: AbortSignal): Promise<AssistantResourceRead>;
}

/** Точка провайдеров ресурсов ассистента. */
export const AssistantResourcePoint: ExtensionPoint<AssistantResourceProvider> =
  defineExtensionPoint<AssistantResourceProvider>('reformer.assistant.resource');

/**
 * Команда «прикрепить ресурс к реплике» — адрес, по которому другой плагин просит ассистента
 * прикрепить ресурс. Регистрирует её ассистент; пока его нет, команды нет, и пункт меню,
 * который её зовёт, вносить не стоит. Аргументы — {@link AssistantAttachArgs}.
 */
export const ASSISTANT_ATTACH_COMMAND_ID = 'ai.attach';

/** Аргументы {@link ASSISTANT_ATTACH_COMMAND_ID}. */
export interface AssistantAttachArgs {
  readonly uri: string;
  /** Имя для чипа. Без него — последний сегмент адреса. */
  readonly name?: string;
}
