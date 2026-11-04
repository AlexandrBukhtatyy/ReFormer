/**
 * Язык intent для операторов ядра: каким ключом `form.intent.json` записывается каждый оператор
 * схемы валидации (`@reformer/core/validation`) и поведения (`@reformer/core/behaviors`).
 *
 * Это не копия данных ядра, а список возможностей компилятора: за каждым ключом стоит печать в
 * генераторе, и оператор, которого здесь нет, сервер не напечатает, даже прочитав его из ядра.
 * Поэтому таблицы живут здесь, а их сверку с исходниками ядра делает тест
 * `tests/operator-catalog.test.ts`: новый оператор в ядре без строки здесь — красный тест.
 *
 * Фабрики правил `@reformer/core/validators` и имена всех операторов ядра здесь не перечислены —
 * их сервер читает из индекса установленного ядра (`core-operators.ts`).
 *
 * @module reformer-mcp/core/generate/operator-catalog
 */

/**
 * Операторы схемы валидации (`@reformer/core/validation`, модуль `operators`) → ключ правила
 * intent, которым сборка его печатает. `cross` — не экспорт, а параметр схемы; он здесь же, потому
 * что пишется тем же способом.
 */
export const VALIDATION_OPERATORS: Readonly<Record<string, string>> = {
  validate: 'rules',
  validateAsync: 'async',
  validateWhen: 'when',
  applyEach: 'each',
  cross: 'cross',
  apply: 'путь группы через точку',
};

/** Операторы поведения над моделью: каждый — свой `kind` записи `behavior`. */
export const MODEL_BEHAVIOR_KINDS = [
  'compute',
  'computeFrom',
  'copyFrom',
  'syncFields',
  'onChange',
  'enableWhen',
  'disableWhen',
  'resetWhen',
  'transformValue',
  'revalidateWhen',
  'exclusiveFlag',
  'aggregateInto',
] as const;

/**
 * Операторы над узлами схемы — тоже `kind` записи `behavior`, но адресуют узел по `selector`, а не
 * поле. Правила узлов исполняет рендерер, поэтому на таргете `core` они не печатаются.
 */
export const NODE_BEHAVIOR_KINDS = [
  'onComponentEvent',
  'renderEffect',
  'onInit',
  'onMount',
  'onUnmount',
] as const;

export type ModelBehaviorKind = (typeof MODEL_BEHAVIOR_KINDS)[number];
export type NodeBehaviorKind = (typeof NODE_BEHAVIOR_KINDS)[number];

/** Операторы поведения, которые записываются не своим `kind`, — чем именно. */
export const BEHAVIOR_KEY_OPERATORS: Readonly<Record<string, string>> = {
  applyEach: 'each',
  apply: 'путь группы через точку',
  hideWhen: 'visibility',
};
