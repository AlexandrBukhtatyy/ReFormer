/** Виды записей `behavior`: операторы поведения над моделью и правила узлов схемы. */

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
