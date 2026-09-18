/**
 * Библиотека генерации: печать модуля формы из схемы, кита и правил.
 *
 * Здесь только чистые функции. РЕШЕНИЕ, какие файлы производить, живёт не тут, а в
 * `plugins/codegen`, где оно выражено вкладами в точку расширения: список целей должен быть
 * расширяемым, а список расширяемым делает реестр, а не модуль.
 *
 * Второй потребитель — `plugins/templates`: встроенные шаблоны печатаются этими же эмиттерами,
 * поэтому «шаблон» и «экспорт» не могут разойтись в том, как выглядит модуль формы.
 *
 * @module @reformer/builder-stack-reformer/codegen
 */

export type { FileClass, GeneratedFile, FormMock } from './types';
export type { CodegenInput, EmitContext, EmittedFileRef } from './context';
export { prepare, withFiles } from './context';
export { makeNames, pascal, humanize, type Names } from './naming';
export { assignSelectors, type AssignResult, type SelectorInfo } from './selectors';
export { collect, type Collected, type TsNode, type TsObject } from './collect';
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

export { emitSchema } from './emit/schema';
export { wizardShimOf, STEP_NAME, type WizardShim } from './view/wizard';
export { appSnippet } from './emit/snippet';

// Печать через шаблоны: вид, который шаблон видит как `it`, и тексты встроенных шаблонов.
// Сам движок и маркер происхождения — в `@reformer/builder-toolkit`: они нужны любому стеку,
// а не только этому. Решение «какие файлы производить» — не здесь, а в `plugins/codegen`.
export { formatTargetFile, parseTargetFile } from './template-file';
export type { TargetFileMeta, TargetFileResult } from './template-file';
export {
  buildView,
  withLocal,
  withViewFiles,
  type CodegenView,
  type Indent,
  type Json,
} from './view';
export {
  apiTemplate,
  indexTemplate,
  modelTemplate,
  dataSourcesTemplate,
  readmeTemplate,
  typesTemplate,
  validationTemplate,
  formBehaviorTemplate,
  wizardTemplate,
  registryTemplate,
  renderBehaviorTemplate,
} from './templates';
