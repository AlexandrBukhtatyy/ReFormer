/**
 * `@reformer/form-intent` — контракт intent формы ReFormer и печать её правил в код.
 *
 * Intent — плоский реестр полей, массивов, правил и поведения плюс дерево раскладки, которое
 * ссылается на них по имени. Пакет даёт:
 *
 * - типы записей (`FormIntent`, `ValidationRuleIntent`, `BehaviorIntent`, …);
 * - нормализацию уже канонического intent: умолчания и предупреждения (`normalizeIntent`);
 * - печать правил: схему валидации (`buildValidationSchemaTs`) и поведение (`buildBehaviorTs`);
 * - документ раскладки (`SchemaDocument`) и обход шагов мастера (`collectSteps`);
 * - поиск циклов в зависимостях поведения (`findCycle`).
 *
 * Только чистые функции, без зависимостей: модуль работает и в Node, и в браузере.
 *
 * @packageDocumentation
 */

export {
  INTENT_CONTRACT_VERSION,
  deriveComponentName,
  deriveInterfaceName,
  modelPaths,
  normalizeIntent,
  type ArrayIntent,
  type BehaviorIntent,
  type DataSourceIntent,
  type FieldIntent,
  type FieldType,
  type FormIntent,
  type IntentWarning,
  type IntentWarningCode,
  type LayoutNode,
  type NodeRuleIntent,
  type ReformerTargetStack,
  type ValidationRuleIntent,
  type VisibilityIntent,
  type WizardIntent,
} from './intent.js';
export {
  buildBehaviorTs,
  buildValidationSchemaTs,
  mentionsName,
  mergeFieldChecks,
  operatorImportLines,
  ruleName,
  type ValidationSchemaTsOptions,
} from './rules-emit.js';
export { collectSteps, stepKeyOf, type SchemaDocNode, type SchemaDocument } from './layout.js';
export {
  NO_UI_KIT,
  normalizeFieldComponent,
  type NormalizedFieldComponent,
  type UiKitComponents,
} from './ui-kit.js';
export { NO_CORE_OPERATORS, type CoreOperators, type CoreRule } from './core-operators.js';
export {
  MODEL_BEHAVIOR_KINDS,
  NODE_BEHAVIOR_KINDS,
  type ModelBehaviorKind,
  type NodeBehaviorKind,
} from './operator-kinds.js';
export { findCycle, type Dependency } from './graph.js';
