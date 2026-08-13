/**
 * Контракты слоя `agent/core` — машиночитаемая поверхность операций редактора.
 *
 * Слой намеренно НЕ знает ни про React, ни про `store/`: инструмент получает схему во входе и
 * возвращает новую схему в выходе. Это даёт два свойства, ради которых слой и разделён:
 *  - его можно покрыть юнитами принятыми в проекте средствами (`environment: 'node'`,
 *    `include: ['src/**\/*.test.ts']` — `.tsx`-тестов в билдере нет);
 *  - ход агента правит ЧЕРНОВИК, а не активную вкладку, поэтому применение результата —
 *    один `editorActions.replaceSchema`, то есть ровно одна запись undo.
 *
 * Адресация узлов — JSON Pointer (RFC 6901) поверх существующих `toPointer`/`fromPointer`
 * (`model/paths`), см. {@link module:reformer-builder/agent/core/node-ref}.
 *
 * @module reformer-builder/agent/core/types
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

/**
 * Бюджет текста ответа инструмента (символы). Ограничение не протокольное, а экономическое:
 * ответ инструмента уходит в контекст модели на КАЖДОМ шаге цикла, поэтому дайджест обязан быть
 * дешевле полного JSON — иначе смысл дайджеста теряется. Реестр обрезает превышение.
 */
export const TOOL_TEXT_BUDGET = 1500;

/** Бюджет имени инструмента (символы). Проверяется тестом, а не в рантайме. */
export const TOOL_NAME_BUDGET = 30;

/** Бюджет описания инструмента (символы). Проверяется тестом, а не в рантайме. */
export const TOOL_DESCRIPTION_BUDGET = 500;

/**
 * Код ошибки инструмента. Коды существуют, чтобы модель чинилась САМА: по коду и `suggestions`
 * она понимает, что именно поправить, вместо «что-то пошло не так».
 */
export type ToolErrorCode =
  /** Имени нет в каталоге. `suggestions` — похожие имена. */
  | 'UNKNOWN_COMPONENT'
  /** `componentProps` не прошли схему компонента. */
  | 'INVALID_PROPS'
  /** Указатель никуда не ведёт либо ведёт не в тот узел (проверка `expect`). */
  | 'STALE_POINTER'
  /** Родитель не принимает детей либо слот не существует. */
  | 'INVALID_PARENT'
  /** Результат не прошёл строгий гейт валидации. */
  | 'SCHEMA_INVALID'
  /** Аргументы вызова не соответствуют `inputSchema`. */
  | 'INVALID_PARAMS'
  /** Инструмента с таким именем нет. `suggestions` — похожие имена. */
  | 'UNKNOWN_TOOL'
  /** Инструмент бросил исключение. Цикл продолжается: модель получает ошибку и пробует иначе. */
  | 'TOOL_FAILED';

/** Структурированная ошибка инструмента. */
export interface ToolError {
  code: ToolErrorCode;
  message: string;
  /** Кандидаты на замену (имена компонентов, имена инструментов). */
  suggestions?: string[];
}

/** Вид операции для списка изменений в предпросмотре. */
export type ChangeOpKind = 'add' | 'update' | 'remove' | 'move';

/** Одна операция хода агента — строка списка изменений в предпросмотре. */
export interface ChangeOp {
  kind: ChangeOpKind;
  /** Указатель затронутого узла ПОСЛЕ операции. */
  ref: string;
  /** Человекочитаемое описание: «Email (Input)», «Email → обязательное». */
  summary: string;
}

/** Вход инструмента: черновик хода и база, от которой считается diff. */
export interface ToolContext {
  /** Схема черновика — то, что инструмент читает и правит. НЕ схема активной вкладки. */
  readonly draft: JsonFormSchema;
  /** Схема на начало хода: база для diff и для проверки конфликта при применении. */
  readonly base: JsonFormSchema;
}

/** Результат вызова инструмента. */
export interface ToolOutcome {
  ok: boolean;
  /** Текст для модели. Реестр обрезает до {@link TOOL_TEXT_BUDGET}. */
  text: string;
  /** Новая схема черновика. Есть только у write-инструментов при `ok: true`. */
  schema?: JsonFormSchema;
  /** Строка для списка изменений. Есть только у write-инструментов при `ok: true`. */
  op?: ChangeOp;
  /** Заполнено при `ok: false`. */
  error?: ToolError;
}

/** Одна операция редактора, описанная машиночитаемо. */
export interface AgentTool<P = never> {
  /** Идентификатор вызова, snake_case. */
  readonly name: string;
  /** Для чего инструмент и когда его выбирать. */
  readonly description: string;
  /** JSON Schema аргументов — сырой объект, как в инструментах `@reformer/mcp` (без zod). */
  readonly inputSchema: object;
  /** Не меняет схему. Определяет, попадёт ли вызов в список изменений. */
  readonly readOnly: boolean;
  run(params: P, ctx: ToolContext): ToolOutcome;
}

/** Успешный ответ read-only инструмента. */
export function ok(text: string): ToolOutcome {
  return { ok: true, text };
}

/** Ответ с ошибкой. */
export function fail(code: ToolErrorCode, message: string, suggestions?: string[]): ToolOutcome {
  return {
    ok: false,
    text: suggestions?.length
      ? `${message} Возможные варианты: ${suggestions.join(', ')}.`
      : message,
    error: { code, message, ...(suggestions?.length ? { suggestions } : {}) },
  };
}
