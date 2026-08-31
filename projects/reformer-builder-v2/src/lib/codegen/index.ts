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
 * @module reformer-builder/lib/codegen
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
export {
  acceptsMarker,
  isGenerated,
  originOf,
  withMarker,
  MARKER_PREFIX,
  type FileOrigin,
} from './marker';

export { emitSchema } from './emit/schema';
export { emitTypes } from './emit/types';
export { emitModel } from './emit/model';
export { emitRegistry } from './emit/registry';
export { emitIndex } from './emit/index-tsx';
export { emitReadme } from './emit/readme';
export { emitDataSources } from './emit/data-sources';
export { emitRenderBehavior } from './emit/render-behavior';
export { emitFormBehavior } from './emit/form-behavior';
export { emitValidation } from './emit/validation';
export { emitApi } from './emit/api';
export { emitWizard, wizardShimOf, STEP_NAME, type WizardShim } from './emit/wizard';
export { appSnippet } from './emit/snippet';
