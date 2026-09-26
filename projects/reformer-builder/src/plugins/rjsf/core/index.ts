/**
 * Ядро домена RJSF: формат документа `rjsf-form/1`, операции правки, проверки и печать `Form.tsx`.
 *
 * Документ — форма react-jsonschema-form как она есть (JSON Schema и uiSchema) в обёртке с
 * `$schema`. Чистый код без React и без рантайма RJSF: рисует форму поверхность плагина
 * `plugins/rjsf/render`, правит — редактор `plugins/rjsf/editor`.
 *
 * @module plugins/rjsf/core
 */

export {
  RJSF_FIELD_TYPES,
  RJSF_PROVIDER_ID,
  RJSF_SCHEMA_ID,
  type RjsfEnumValue,
  type RjsfFieldSchema,
  type RjsfFieldType,
  type RjsfFieldUi,
  type RjsfForm,
  type RjsfObjectSchema,
  type RjsfUiSchema,
  type RjsfValues,
} from './schema';
export { isRjsfForm, looksLikeRjsfForm, parseRjsfForm, printRjsfForm } from './parse';
export {
  applyRjsfOp,
  displayOrder,
  nextFieldName,
  type RjsfApplyResult,
  type RjsfFieldPlace,
  type RjsfOp,
} from './ops';
export { initialValues, newField, sampleForm } from './defaults';
export {
  checkRjsfForm,
  RJSF_STANDARD_WIDGETS,
  RJSF_WIDGET_ALIASES,
  type RjsfCheckOptions,
  type RjsfProblem,
  type RjsfProblemCode,
} from './check';
export { printFormModule, type PrintFormOptions } from './print-form';
