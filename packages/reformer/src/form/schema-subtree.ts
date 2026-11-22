/**
 * Поддерево схемы для под-модели: содержимое строки массива (`item`) или подформы (`part`).
 *
 * Билдер поддерева зовут два места — сборка формы и рендерер. Оба обязаны получить ОДНО дерево:
 * на объектах его узлов держится идентичность (ключи рендера, записи схемы-контроллера), а сам
 * билдер не обязан быть чистым. Поэтому дерево строится один раз на пару «билдер + под-модель»
 * и дальше отдаётся из памяти.
 *
 * Память привязана к под-модели: исчезла строка массива — исчезли и её поддеревья.
 *
 * @group Utilities
 * @module form/schema-subtree
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const subtrees = new WeakMap<object, Map<unknown, unknown>>();

/**
 * Поддерево схемы для под-модели — результат `builder(subModel)`, один на пару.
 *
 * @typeParam N - Тип узла, который возвращает билдер.
 * @param builder - Билдер поддерева: `item` узла-массива или `part` узла-подформы.
 * @param subModel - Под-модель строки массива или группы.
 * @returns Узел поддерева; повторный вызов с той же парой отдаёт тот же объект.
 *
 * @example
 * ```typescript
 * const row = model.items.at(0);
 * schemaSubtree(itemSchema, row) === schemaSubtree(itemSchema, row); // true
 * ```
 */
export function schemaSubtree<N>(builder: (subModel: any) => N, subModel: object): N {
  let byBuilder = subtrees.get(subModel);
  if (!byBuilder) {
    byBuilder = new Map();
    subtrees.set(subModel, byBuilder);
  }
  if (!byBuilder.has(builder)) byBuilder.set(builder, builder(subModel));
  return byBuilder.get(builder) as N;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
