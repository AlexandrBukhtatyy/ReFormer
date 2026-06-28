/**
 * Слой данных FormModel (M1) — публичные экспорты.
 *
 * @group Model
 * @module core/model
 */

export { createModel } from './form-model';
export { validateModel, validateModelSync, validateFormModel } from './validate-model';
export type { ModelValidator, ModelValidationResult } from './validate-model';
export {
  computeFrom,
  copyFrom,
  watchField,
  enableWhen,
  disableWhen,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
} from './behaviors';
export type { BehaviorCleanup } from './behaviors';
export type {
  FormModel,
  ModelArray,
  ModelObject,
  ModelValue,
  ModelSignals,
  ModelApi,
  PathAwareSignal,
} from './types';
