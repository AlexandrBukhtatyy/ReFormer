/**
 * Стабильный ключ строки массива модели — по идентичности под-модели строки.
 *
 * Один источник для формы (`FormArray.keyAt`, область строки в скомпилированной схеме) и для
 * таблицы (ключ строки клиентского режима): ключ держится за элемент модели и не меняется при
 * `move` и `swap`, поэтому строка формы и строка таблицы над одной под-моделью получают один ключ.
 *
 * @internal
 * @module model/row-key
 */

const rowKeys = new WeakMap<object, number>();
let rowKeyCounter = 0;

/** Ключ строки по её под-модели; первый запрос выдаёт новый ключ. */
export function rowKeyOf(rowModel: object): number {
  let key = rowKeys.get(rowModel);
  if (key === undefined) {
    key = rowKeyCounter++;
    rowKeys.set(rowModel, key);
  }
  return key;
}
