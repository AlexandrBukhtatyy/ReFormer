/**
 * Стабильный ключ строки массива под-форм — по идентичности под-модели строки.
 *
 * Один источник для области строки в скомпилированной схеме (`#/phones[<ключ>]`) и для
 * `FormArray.keyAt(index)`: ключ держится за элемент модели и не меняется при `move` и `swap`.
 *
 * @internal
 * @module form/schema/row-key
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
