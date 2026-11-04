/**
 * Компилятор intent формы для встраивания — точка входа `@reformer/mcp/intent`.
 *
 * Сервер отдаёт компиляцию intent инструментами (`generate_form`, `form_build`). Конструктор форм
 * собирает тот же intent у себя в процессе, своим инструментом над своим документом (`build_form`
 * ассистента билдера): ему нужны чтение, раскладка и печать правил, но не сервер и не диск. Раньше
 * он брал их глубокими импортами `@reformer/mcp/dist/core/generate/*` — путями, которые пакет
 * никому не обещал.
 *
 * Только чистые функции: модуль лежит в `core/`, и `check:no-node-globals` следит, чтобы сюда не
 * попал ни один node-глобал.
 *
 * @module reformer-mcp/core/intent
 */

export {
  MODULE_ONLY_WARNINGS,
  modelPaths,
  normalizeIntent,
  readIntent,
  type ArrayIntent,
  type BehaviorIntent,
  type DataSourceIntent,
  type FieldIntent,
  type FieldType,
  type FormIntent,
  type IntentProblem,
  type IntentReading,
  type IntentWarning,
  type IntentWarningCode,
  type LayoutNode,
  type NodeRuleIntent,
  type ReadIntentOptions,
  type ValidationRuleIntent,
  type VisibilityIntent,
  type WizardIntent,
} from './generate/form-intent.js';
export {
  buildSchemaLayout,
  collectSteps,
  stepKeyOf,
  type SchemaDocNode,
  type SchemaDocument,
  type SchemaLayout,
} from './generate/schema-emit.js';
export { inspectLayoutRefs } from './generate/cross-check.js';
export { buildBehaviorTs, buildValidationSchemaTs, mergeFieldChecks } from './generate/builders.js';
export {
  NO_UI_KIT,
  normalizeFieldComponent,
  uiKitFromCatalog,
  type UiKitComponents,
} from './generate/ui-kit-components.js';
export {
  coreOperatorsFromIndex,
  NO_CORE_OPERATORS,
  type CoreOperators,
  type CoreRule,
} from './generate/core-operators.js';
export { findCycle, type Dependency } from './utils/graph.js';
