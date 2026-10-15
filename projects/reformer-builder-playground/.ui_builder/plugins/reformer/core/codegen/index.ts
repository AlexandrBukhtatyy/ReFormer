/**
 * Библиотека генерации: печать модуля формы из схемы, кита и правил.
 *
 * Печатается модуль ЕДИНОГО контракта сборки (`createForm` + `useFormBundle` + `FormRenderer`,
 * одно поведение, `FormValidation`, поток шагов у визарда, библиотечный визард) в раскладке
 * «папки по ролям» — см. `./layout`.
 *
 * Здесь только чистые функции. РЕШЕНИЕ, какие файлы производить, живёт не тут, а в
 * `plugins/reformer/codegen`, где оно выражено вкладами в точку расширения: список целей должен быть
 * расширяемым, а список расширяемым делает реестр, а не модуль.
 *
 * Второй потребитель — `plugins/reformer/templates`: встроенные шаблоны печатаются этими же эмиттерами,
 * поэтому «шаблон» и «экспорт» не могут разойтись в том, как выглядит модуль формы.
 *
 * @module plugins/reformer/core/codegen
 */

export type { FileClass, GeneratedFile, FormMock } from './types';
export type { CodegenInput, EmitContext, EmittedFileRef } from './context';
export { prepare, withFiles, withStep } from './context';

// Раскладка модуля: папки ролей, пути файлов, место модуля относительно документа формы.
export {
  SCHEMA_DIR,
  SCHEMA_FILE,
  LEGACY_SCHEMA_FILE,
  DEFAULT_SCHEMA_PATH,
  STEP_SCHEMAS_DIR,
  VALIDATION_DIR,
  FORM_RULES_NAME,
  MESSAGES_NAME,
  RESERVED_STEP_NAMES,
  FLAT_LAYOUT_FILES,
  FLAT_STEPS_DIR,
  FLAT_STEPS_INDEX,
  FLAT_STEP_FILES,
  moduleFilesOf,
  stepValidationPath,
  stepSchemaPath,
  schemaDirOf,
  moduleDirOfSchemaPath,
  moduleRootPathOf,
  moduleRootOfDocument,
  detachedModuleDirOf,
  schemaPathInModule,
  modulePlacementOf,
  isCanonicalSchemaName,
  isFlatLayoutPath,
  formNameOfSchemaPath,
  importOf,
  type ModuleFiles,
  type ModuleNames,
  type ModulePlacement,
  type ModuleRootPort,
} from './layout';
export { layoutOf, type ModuleLayout, type StepInfo } from './steps';
export { stepDirName } from '../form-model/step-dir';
export { makeNames, pascal, camel, humanize, stepRulesAlias, type Names } from './naming';
export { assignSelectors, type AssignResult, type SelectorInfo } from './selectors';
export { collect, wizardStepsOf, type Collected, type TsNode, type TsObject } from './collect';
export {
  buildInitialValues,
  classifyDataSources,
  collectFieldDefaults,
  defaultForField,
  fieldKindOf,
  mockOptions,
  synthMock,
  type DataSourceClasses,
  type FieldDefault,
  type FieldKind,
  type MockOption,
} from '../form-mock';
export { resolveComponent, type ComponentResolution, type KitView } from './components';

export { emitSchema, emitStepSchema } from './emit/schema';

// Раскладка под ширину строки — та, которой печатается модуль: вывод проходит prettier как есть.
// `printJson` нужен и вне кодогена: документ формы, записанный им, форматтер не переписывает.
export {
  formatBody,
  formatStatement,
  printConst,
  printImport,
  printJson,
  printLiteral,
  printSignature,
  quote,
  type ImportKind,
  type LiteralOptions,
} from './print/js';
export { PRINT_WIDTH, TAB_WIDTH, type PrintOptions } from './print/doc';
export { appSnippet } from './emit/snippet';

// Печать через шаблоны: вид, который шаблон видит как `it`, и тексты встроенных шаблонов.
// Сам движок и маркер происхождения — в `@reformer/builder-toolkit`: они нужны любому стеку,
// а не только этому. Решение «какие файлы производить» — не здесь, а в `plugins/reformer/codegen`.
export { formatTargetFile, parseTargetFile } from './template-file';
export type { TargetFileMeta, TargetFileResult } from './template-file';
export {
  buildView,
  withLocal,
  withViewFiles,
  withStepView,
  stepView,
  type CodegenView,
  type LayoutView,
  type StepEntryView,
  type StepView,
  type RulesView,
  type RulesBlockView,
  type ValidationView,
  type SubmitView,
  type Indent,
  type Json,
  type Rel,
  type Format,
  type Literal,
  type Imports,
  type Signature,
  type Fits,
  type DataSourcesView,
} from './view';
export type { BehaviorView, BehaviorGroupView, RowBehaviorView } from './view/behavior';
export type { MessagesView, MessageEntryView } from './view/messages';
export {
  STEP_NAME,
  STEP_IMPORT,
  type RegistryView,
  type RegistryWizardView,
} from './view/registry';
export {
  apiTemplate,
  barrelTemplate,
  createTemplate,
  dataSourcesTemplate,
  entryTemplate,
  flowTemplate,
  formBehaviorTemplate,
  initialTemplate,
  messagesTemplate,
  modelTemplate,
  pageTemplate,
  readmeTemplate,
  registryTemplate,
  stepValidationTemplate,
  submitTemplate,
  typesTemplate,
  validationTemplate,
} from './templates';
