/**
 * Инструменты ассистента от плагинов — чем плагин даёт модели своё действие.
 *
 * ## Зачем точка, если у команды есть блок `agent`
 *
 * Команда с блоком `agent` (`primitives/command`) — действие ЧЕЛОВЕКА, которое заодно видно
 * модели: у неё нет контекста вызова, её запись не принадлежит ходу ассистента и потому не
 * откатывается «Отменить последний ход», а ответ — то, что вернула команда палитре. Инструмент
 * отсюда — действие МОДЕЛИ: получает сигнал остановки хода и дверь записи, которую ход
 * помечает своим идентификатором и откатывает целиком, а ответ пишется для модели.
 *
 * ## Поверхность платится каждым шагом
 *
 * Имя, описание и схема аргументов уходят модели в КАЖДОМ запросе хода. Поэтому у вкладов
 * плагинов свой общий потолок поверхности (его держит ассистент): что в него не влезло,
 * отбрасывается по `order` вклада с диагностикой, а ход не ломается. Лимиты ниже — на один
 * инструмент; их нарушение — отказ этого вклада, а не всех.
 *
 * ## Запись — только дверью контекста
 *
 * {@link AssistantToolContext.write} пишет в рабочую копию с пометкой «агент, этот ход», и
 * отмена хода откатывает её вместе с правками самой модели. Запись мимо неё (службой документов
 * напрямую) ход не увидит: отменить её кнопкой ассистента будет нельзя.
 *
 * @module @reformer/builder-plugin-api/assistant/tools
 */

import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';
import type { ResourceId } from '../primitives/resource.js';

/** Предел длины имени инструмента (символы). */
export const ASSISTANT_TOOL_NAME_MAX = 30;

/** Предел длины описания инструмента (символы). Описание — для модели, по-английски. */
export const ASSISTANT_TOOL_DESCRIPTION_MAX = 500;

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Годится ли строка в имя инструмента: `snake_case`, с буквы, не длиннее
 * {@link ASSISTANT_TOOL_NAME_MAX}. Модель зовёт инструмент по имени, поэтому подставлять
 * исправленное имя за автора нельзя — неверное имя отвергается.
 */
export function isAssistantToolName(name: string): boolean {
  return name.length <= ASSISTANT_TOOL_NAME_MAX && TOOL_NAME_PATTERN.test(name);
}

/**
 * Код ошибки для модели. Один словарь на инструменты и ресурсы: по коду модель решает, что
 * делать дальше, — искать другой путь (`NOT_FOUND`), не повторять (`REFUSED`, `UNSUPPORTED`),
 * читать частями (`TOO_LARGE`) или сказать пользователю (`UNAVAILABLE`).
 */
export type AssistantErrorCode =
  | 'NOT_FOUND'
  | 'REFUSED'
  | 'UNSUPPORTED'
  | 'TOO_LARGE'
  | 'UNAVAILABLE'
  | 'FAILED';

/** Ошибка для модели: код, фраза по-английски и, если есть, кандидаты на замену. */
export interface AssistantError {
  readonly code: AssistantErrorCode;
  readonly message: string;
  readonly suggestions?: readonly string[];
}

/** Ответ инструмента. Строка — то же, что `{ ok: true, text }`. */
export type AssistantToolResult =
  | string
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: AssistantError };

/**
 * Почему запись не принята:
 * - `read-only` — инструмент объявлен только читающим;
 * - `refused` — ресурс ход правит своим механизмом (например, документ формы), и вторая
 *   дверь к нему разошлась бы с первой;
 * - `turn-ended` — ход уже закончился, а запись пришла позже (утёкший промис);
 * - `unavailable` — писать некуда: проект закрыт;
 * - `failed` — запись сорвалась в рабочей области.
 */
export type AssistantWriteRefusal =
  | 'read-only'
  | 'refused'
  | 'turn-ended'
  | 'unavailable'
  | 'failed';

/** Итог записи. Отказ — значение, а не исключение: инструмент решает, что сказать модели. */
export type AssistantWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: AssistantWriteRefusal; readonly message: string };

/** Что ход даёт вызову инструмента. */
export interface AssistantToolContext {
  /** Срабатывает, когда ход останавливают. Долгое чтение обязано на него смотреть. */
  readonly signal: AbortSignal;
  /**
   * Записать текст ресурса в рабочую копию от имени хода. Запись помечается как правка
   * ассистента в этом ходе и откатывается «Отменить последний ход»; наружу, в источник, она
   * уходит только сохранением, как и любая правка.
   */
  write(resource: ResourceId, text: string): Promise<AssistantWriteResult>;
}

/**
 * Инструмент, который плагин даёт модели.
 *
 * `P` — тип аргументов после проверки по {@link inputSchema}: ассистент проверяет аргументы
 * до вызова, и `run` с неверными не зовётся.
 */
export interface AssistantTool<P = unknown> {
  /** Имя вызова, см. {@link isAssistantToolName}. Уникально среди всех инструментов хода. */
  readonly name: string;
  /** Для модели: что делает и когда выбирать. По-английски, не ключ i18n. */
  readonly description: string;
  /** JSON Schema аргументов, корень — `{ type: 'object' }`. */
  readonly inputSchema: object;
  /** Только читает. Такому инструменту запись отказана, а повторные чтения ассистент сжимает. */
  readonly readOnly: boolean;
  /** Выполнить вызов. Исключение не роняет ход: модель получает ошибку `FAILED`. */
  run(params: P, ctx: AssistantToolContext): AssistantToolResult | Promise<AssistantToolResult>;
}

/**
 * Точка инструментов ассистента. Ассистент читает её на каждом ходе: инструмент выключенного
 * плагина исчезает со следующего.
 */
export const AssistantToolPoint: ExtensionPoint<AssistantTool> =
  defineExtensionPoint<AssistantTool>('reformer.assistant.tool');
