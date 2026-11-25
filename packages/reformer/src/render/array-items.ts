/**
 * Строки массива модели: стабильные ключи и перевод индексов модели в индексы строк формы.
 *
 * @module render/array-items
 */

/** Чтение массива модели, которого достаточно для обхода строк. */
export interface ArrayReader {
  at(index: number): unknown;
}

const itemKeys = new WeakMap<object, number>();
let keyCounter = 0;

/**
 * Стабильный ключ строки по идентичности под-модели элемента: перестановка строк ключи не меняет,
 * и поддерево строки переезжает вместе с ней. У примитива идентичности нет — ключ каждый раз новый.
 */
export function stableKey(item: unknown): number {
  if (item == null || typeof item !== 'object') return keyCounter++;
  let key = itemKeys.get(item);
  if (key === undefined) {
    key = keyCounter++;
    itemKeys.set(item, key);
  }
  return key;
}

/**
 * Индекс строки формы для индекса элемента модели: строка `i` — `i`-й непустой элемент. Для
 * элемента `null` строки формы нет — `undefined`.
 */
export function formIndexOf(control: ArrayReader, modelIndex: number): number | undefined {
  if (control.at(modelIndex) == null) return undefined;
  let formIndex = 0;
  for (let position = 0; position < modelIndex; position++) {
    if (control.at(position) != null) formIndex++;
  }
  return formIndex;
}
