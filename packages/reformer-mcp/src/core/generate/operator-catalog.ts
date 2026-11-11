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
  apply: 'dotted group path',
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
 * Виды поведения, у которых сборка печатает `options` записи третьим аргументом оператора. У
 * остальных параметров в ядре нет (у `compute`/`computeFrom` — только `when`, его чтение переносит
 * отдельно): записанные `options` были бы потеряны молча, поэтому чтение intent их отклоняет
 * (ReFormer-11oe.11). Совпадение со сборкой держит тест.
 */
export const BEHAVIOR_KINDS_WITH_OPTIONS = [
  'copyFrom',
  'syncFields',
  'onChange',
  'enableWhen',
  'disableWhen',
  'resetWhen',
] as const satisfies readonly ModelBehaviorKind[];

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
  apply: 'dotted group path',
  hideWhen: 'visibility',
};

/**
 * Экспорты `./behaviors` и `./validation`, которые не операторы, а основа: ими пишут свою схему и
 * свой оператор (`defineFormBehavior`, `effect`, `validateModel`, …). В intent их не записывают, и
 * грамматика о них молчит. Список сверяет с исходниками ядра `tests/operator-catalog.test.ts`.
 */
export const CORE_OPERATOR_FOUNDATION: ReadonlySet<string> = new Set([
  'Signal',
  'defer',
  'defineFormBehavior',
  'effect',
  'getScope',
  'onDispose',
  'applyValidationResult',
  'createFormValidation',
  'defineValidation',
  'runValidation',
  'validateModel',
]);

/** Всё, что язык intent записывает своим ключом. */
const KEYED_OPERATORS: ReadonlySet<string> = new Set([
  ...Object.keys(VALIDATION_OPERATORS),
  ...MODEL_BEHAVIOR_KINDS,
  ...NODE_BEHAVIOR_KINDS,
  ...Object.keys(BEHAVIOR_KEY_OPERATORS),
]);

/**
 * Операторы установленного ядра, которых нет в языке intent (ReFormer-wkva).
 *
 * Ядро бывает новее сервера: оператор, добавленный в ядро позже, сервер напечатать не умеет, но
 * агент может вызвать его через `kind: "call"` из своего модуля. Без этого списка грамматика о нём
 * молчала, и агент не узнавал, что такой оператор вообще есть.
 */
export function operatorsWithoutIntentKey(operatorNames: Iterable<string>): string[] {
  return [...new Set(operatorNames)]
    .filter((name) => !KEYED_OPERATORS.has(name) && !CORE_OPERATOR_FOUNDATION.has(name))
    .sort();
}
