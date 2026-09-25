/**
 * Демо-стек ReFormer Builder: свой формат схемы, свой рендер, свой экспорт.
 *
 * Не продукт, а доказательство швов. Стек ReFormer редактирует схемы `@reformer/renderer-json`;
 * этот — плоский список полей `plain-form/1`, рисует их нативными элементами и печатает
 * `Form.tsx` без единой библиотеки форм. Ни `@reformer/renderer-json`, ни `@reformer/core`,
 * ни пакета стека ReFormer здесь нет — и тест пакета это проверяет.
 *
 * Плагин стека живёт в билдере (`plugins/plain/demo`), а здесь — его чистая часть.
 *
 * @module @reformer/builder-stack-plain
 */

export {
  PLAIN_FIELD_TYPES,
  PLAIN_SCHEMA_ID,
  type PlainField,
  type PlainFieldType,
  type PlainForm,
  type PlainValues,
} from './schema';
export { isPlainForm, looksLikePlainForm, parsePlainForm, printPlainForm } from './parse';
export { applyPlainOp, nextFieldName, type PlainApplyResult, type PlainOp } from './ops';
export { emptyValueOf, initialValues, sampleForm } from './defaults';
export { checkPlainForm, type PlainProblem, type PlainProblemCode } from './check';
export { printFormModule, type PrintFormOptions } from './print-form';
