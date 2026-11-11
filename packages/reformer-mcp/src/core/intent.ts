/**
 * Компилятор intent формы для встраивания — точка входа `@reformer/mcp/intent`.
 *
 * Сервер отдаёт компиляцию intent инструментом `form_build` (под Node). Конструктор форм
 * собирает тот же intent у себя в процессе, своим инструментом над своим документом (`build_form`
 * ассистента билдера): ему нужны чтение, вердикт, раскладка и печать правил, но не сервер и не диск.
 * Раньше он брал их глубокими импортами `@reformer/mcp/dist/core/generate/*` — путями, которые пакет
 * никому не обещал.
 *
 * Вердикт `judgeIntent` совпадает с вердиктом `form_build` и `validate_form`, только когда хост даёт
 * судье те же справочники. Поэтому здесь и тип справочников, и разбор props-схем кита: без схем
 * чтение не знает, каких свойств у компонента нет, и `min` у `Input` уходит в `componentProps` там,
 * где сборка называет ошибку `prop-unsupported`.
 *
 * Только чистые функции: модуль лежит в `core/`, и `check:no-node-globals` следит, чтобы сюда не
 * попал ни один node-глобал.
 *
 * @module reformer-mcp/core/intent
 */

export {
  INTENT_CONTRACT_VERSION,
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
  type IntentProblemCode,
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
export { inspectLayoutRefs, inspectSteps } from './generate/cross-check.js';
export { documentCapabilities, type DocumentCapabilities } from './generate/document.js';
export {
  DOCUMENT_GRAMMAR_EXAMPLE,
  DOCUMENT_GRAMMAR_LIMIT,
  intentGrammar,
  type GrammarPart,
  type GrammarRequest,
  type IntentGrammarOptions,
} from './generate/intent-grammar.js';
export {
  judgeIntent,
  type IntentVerdict,
  type JudgeCode,
  type JudgeFinding,
  type JudgeOptions,
  type JudgeWarningCode,
} from './generate/judge.js';
// Только тип: модуль справочников тянет знание (`memoize`), а точке входа оно не нужно.
export type { FormCatalogs } from './generate/catalogs.js';
export { buildBehaviorTs, buildValidationSchemaTs, mergeFieldChecks } from './generate/builders.js';
export {
  NO_UI_KIT,
  normalizeFieldComponent,
  uiKitFromCatalog,
  type UiKitComponents,
} from './generate/ui-kit-components.js';
export { uiKitPropsFromCatalog, type UiKitPropSchemas } from './generate/ui-kit-props.js';
export {
  coreOperatorsFromIndex,
  NO_CORE_OPERATORS,
  type CoreOperators,
  type CoreRule,
} from './generate/core-operators.js';
export { findCycle, type Dependency } from './utils/graph.js';
