/**
 * JSON-путь и иммутабельные операции над `JsonFormSchema`.
 *
 * Путь — массив ключей/индексов от корня документа-схемы (`JsonFormSchema`), а не от `root`-узла.
 * Так корневой узел лежит по пути `['root']`, его первый ребёнок — `['root', 'children', 0]`,
 * шаг wizard — `['root', 'componentProps', 'steps', 1]` и т.д.
 *
 * Один и тот же путь служит и локатором для правок ({@link updateAt}), и для выделения узла,
 * и для подсветки в raw-JSON ({@link toPointer} → RFC 6901).
 *
 * Все операции ИММУТАБЕЛЬНЫ и с structural sharing: клонируются только узлы вдоль пути,
 * нетронутые поддеревья сохраняют ссылочную идентичность (дёшево для undo/redo снимков).
 *
 * @module reformer-builder/model/paths
 */

/** Сегмент JSON-пути: ключ объекта (строка) или индекс массива (число). */
export type JsonPathSegment = string | number;

/** Путь к значению внутри `JsonFormSchema` от корня документа. */
export type JsonPath = readonly JsonPathSegment[];

/**
 * Значение по пути (без клонирования). Возвращает `undefined`, если путь ведёт «в никуда».
 *
 * @param root - Корень документа (или любой под-узел).
 * @param path - Путь от `root`.
 */
export function getAt(root: unknown, path: JsonPath): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<JsonPathSegment, unknown>)[seg];
  }
  return cur;
}

/**
 * Иммутабельная правка значения по пути. Клонирует только узлы вдоль пути (structural sharing);
 * `updater` получает текущее значение листа и возвращает новое.
 *
 * Промежуточные контейнеры создаются при необходимости: отсутствующий объект → `{}`,
 * но массивы сами не создаются — путь через несуществующий индекс массива не поддерживается
 * (используйте {@link insertNode} из `mutate.ts` для вставки в массивы).
 *
 * @param root - Корень (документ или под-дерево).
 * @param path - Путь от `root` до правимого значения.
 * @param updater - `(currentValue) => newValue`.
 * @returns Новый корень с применённой правкой.
 */
export function updateAt<T>(root: T, path: JsonPath, updater: (value: unknown) => unknown): T {
  if (path.length === 0) return updater(root) as T;
  const [head, ...rest] = path;
  const child = root == null ? undefined : (root as Record<JsonPathSegment, unknown>)[head];
  const nextChild = updateAt(child, rest, updater);
  if (Array.isArray(root)) {
    const clone = root.slice();
    clone[head as number] = nextChild;
    return clone as unknown as T;
  }
  const clone: Record<JsonPathSegment, unknown> = { ...(root as object) };
  clone[head] = nextChild;
  return clone as unknown as T;
}

/**
 * Иммутабельное удаление значения по пути. Для последнего сегмента: элемент массива вырезается
 * (splice-семантика, индексы сдвигаются), ключ объекта — удаляется.
 *
 * @param root - Корень документа.
 * @param path - Путь до удаляемого значения (непустой).
 * @returns Новый корень без указанного значения.
 * @throws Если путь пуст (корень удалить нельзя).
 */
export function removeAt<T>(root: T, path: JsonPath): T {
  if (path.length === 0) throw new Error('removeAt: нельзя удалить корень (пустой путь)');
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  return updateAt(root, parentPath, (parent: unknown) => {
    if (Array.isArray(parent)) {
      const idx = typeof key === 'number' ? key : Number(key);
      return parent.filter((_, i) => i !== idx);
    }
    const clone: Record<JsonPathSegment, unknown> = { ...(parent as object) };
    delete clone[key];
    return clone;
  });
}

/**
 * Путь → строка JSON Pointer (RFC 6901). Экранирует `~` → `~0`, `/` → `~1`.
 * Пустой путь даёт `''` (весь документ).
 *
 * @example toPointer(['root', 'children', 0]) // '/root/children/0'
 */
export function toPointer(path: JsonPath): string {
  return path.map((seg) => '/' + String(seg).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
}

/**
 * Строка JSON Pointer (RFC 6901) → путь. Числовые сегменты остаются строками
 * (Pointer не различает индекс и ключ); для доступа это неважно — `getAt`/`updateAt`
 * индексируют и по строке-числу.
 *
 * @example fromPointer('/root/children/0') // ['root', 'children', '0']
 */
export function fromPointer(pointer: string): JsonPath {
  if (pointer === '') return [];
  return pointer
    .split('/')
    .slice(1)
    .map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Сравнение путей посегментно (по значению, с приведением сегментов к строке). */
export function pathEquals(a: JsonPath, b: JsonPath): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (String(a[i]) !== String(b[i])) return false;
  return true;
}

/** `prefix` — префикс `path` (или равен ему). Полезно, чтобы не бросить узел внутрь самого себя. */
export function isPrefix(prefix: JsonPath, path: JsonPath): boolean {
  if (prefix.length > path.length) return false;
  for (let i = 0; i < prefix.length; i++) if (String(prefix[i]) !== String(path[i])) return false;
  return true;
}
