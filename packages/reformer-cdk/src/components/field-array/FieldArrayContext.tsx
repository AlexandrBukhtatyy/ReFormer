/**
 * Re-export FieldArray context from core
 *
 * Контекст определён в @reformer/core для обеспечения совместимости
 * между RenderSchema (core) и compound-компонентами (ui).
 */

import { createContext, useContext } from 'react';
import type { FormArray, FormGroup, ValidationIssue } from '@reformer/core';

/**
 * Представляет элемент массива с контролом, индексом и действиями (включая хелперы reorder,
 * чтобы консументы сырого `useFieldArray`/контекста получали тот же набор, что и `FieldArray.List`).
 */
export interface FieldArrayItem<T extends object> {
  /** Контрол для данного элемента */
  control: FormGroup<T>;
  /** Индекс элемента (0-based) */
  index: number;
  /** Уникальный идентификатор для React key */
  id: string;
  /** Удалить этот элемент из массива */
  remove: () => void;
  /** Переместить элемент на одну позицию вверх (no-op если он первый) */
  moveUp: () => void;
  /** Переместить элемент на одну позицию вниз (no-op если он последний) */
  moveDown: () => void;
  /** Можно ли переместить вверх (index > 0) */
  canMoveUp: boolean;
  /** Можно ли переместить вниз (index < length - 1) */
  canMoveDown: boolean;
}

/**
 * Контекст уровня массива
 */
export interface FieldArrayContextValue<T extends object = Record<string, unknown>> {
  /** Массив элементов с контролами и действиями */
  items: FieldArrayItem<T>[];
  /** Текущая длина массива */
  length: number;
  /** Пустой ли массив */
  isEmpty: boolean;
  /** Добавить новый элемент в конец */
  add: (value?: Partial<T>) => void;
  /** Удалить все элементы */
  clear: () => void;
  /** Вставить элемент на указанную позицию */
  insert: (index: number, value?: Partial<T>) => void;
  /** Удалить элемент по индексу (симметрично insert-by-index) */
  removeAt: (index: number) => void;
  /** Переместить элемент (реордер, состояние сохраняется) */
  move: (from: number, to: number) => void;
  /** Поменять местами два элемента (реордер, состояние сохраняется) */
  swap: (a: number, b: number) => void;
  /** Получить контрол элемента по индексу */
  at: (index: number) => FormGroup<T> | undefined;
  /** Ошибки уровня массива (например `minItems` / «At least one phone required») */
  issues: ValidationIssue[];
  /** Валиден ли массив (и все его элементы) */
  valid: boolean;
  /** Невалиден ли массив (есть ошибки массива или любого элемента) */
  invalid: boolean;
  /** Оригинальный узел массива. */
  control: FormArray<T>;
}

/**
 * Контекст уровня элемента массива
 */
export interface FieldArrayItemContextValue<T extends object = Record<string, unknown>> {
  /** Контрол для данного элемента */
  control: FormGroup<T>;
  /** Индекс элемента (0-based) */
  index: number;
  /** Уникальный идентификатор для React key */
  id: string;
  /** Удалить этот элемент из массива */
  remove: () => void;
  /** Переместить элемент на одну позицию вверх (no-op если он первый) */
  moveUp: () => void;
  /** Переместить элемент на одну позицию вниз (no-op если он последний) */
  moveDown: () => void;
  /** Можно ли переместить вверх (index > 0) */
  canMoveUp: boolean;
  /** Можно ли переместить вниз (index < length - 1) */
  canMoveDown: boolean;
}

/**
 * React context, который снабжает дочерние компоненты `FieldArray` (List, AddButton, …)
 * текущим `ArrayNode` и хелперами. Создаётся `FieldArray.Root`. Читать через {@link useFieldArrayContext}.
 *
 * @example
 * ```tsx
 * import { FieldArrayContext } from '@reformer/cdk/field-array';
 *
 * function MyConsumer() {
 *   const ctx = useContext(FieldArrayContext);
 *   return <span>items: {ctx?.items.length}</span>;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FieldArrayContext = createContext<FieldArrayContextValue<any> | null>(null);

/**
 * React context, видимый внутри `FieldArray.List` для одного элемента массива.
 * Содержит `control`, `index`, `id`, `remove()` и хелперы реордера
 * (`moveUp`/`moveDown`, `canMoveUp`/`canMoveDown`). Читать через {@link useFieldArrayItemContext}.
 *
 * @example
 * ```tsx
 * import { FieldArrayItemContext } from '@reformer/cdk/field-array';
 *
 * function CurrentIndex() {
 *   const item = useContext(FieldArrayItemContext);
 *   return <small>#{item?.index}</small>;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FieldArrayItemContext = createContext<FieldArrayItemContextValue<any> | null>(null);

/**
 * Хук для доступа к контексту `FieldArray`. Бросает исключение, если вызван вне
 * `FieldArray.Root` или эквивалентного провайдера.
 *
 * @returns Текущий {@link FieldArrayContextValue}.
 * @throws Error если используется вне `FieldArray.Root`.
 *
 * @example Кастомный AddButton с predefined значением
 * ```tsx
 * import { useFieldArrayContext } from '@reformer/cdk/field-array';
 *
 * function AddDraftButton() {
 *   const { add } = useFieldArrayContext<Item>();
 *   return (
 *     <button onClick={() => add({ status: 'draft', createdAt: Date.now() })}>
 *       + Add Draft
 *     </button>
 *   );
 * }
 * ```
 *
 * @example Счётчик и условный empty-state из произвольного места дерева
 * ```tsx
 * function ItemsBadge() {
 *   const { length, isEmpty } = useFieldArrayContext();
 *   if (isEmpty) return <span className="text-gray-400">Нет элементов</span>;
 *   return <span className="badge">{length}</span>;
 * }
 * ```
 */
export function useFieldArrayContext<
  T extends object = Record<string, unknown>,
>(): FieldArrayContextValue<T> {
  const context = useContext(FieldArrayContext) as FieldArrayContextValue<T> | null;
  if (!context) {
    throw new Error(
      'FieldArray.* components must be used within FieldArray.Root or RenderSchema FieldArray'
    );
  }
  return context;
}

/**
 * Хук для доступа к контексту текущего элемента внутри `FieldArray.List`.
 *
 * @returns Текущий {@link FieldArrayItemContextValue} (`control`, `index`, `id`, `remove`,
 *   `moveUp`/`moveDown`, `canMoveUp`/`canMoveDown`).
 * @throws Error если используется вне `FieldArray.List` или item-шаблона.
 *
 * @example Кнопка удаления текущего элемента
 * ```tsx
 * import { useFieldArrayItemContext } from '@reformer/cdk/field-array';
 *
 * function ItemRemoveButton() {
 *   const { remove } = useFieldArrayItemContext();
 *   return <button onClick={remove}>×</button>;
 * }
 * ```
 *
 * @example Доступ к control + index для условной валидации
 * ```tsx
 * function ItemHeader() {
 *   const { control, index } = useFieldArrayItemContext<Property>();
 *   const { value: type } = useFormControl(control.type);
 *   return (
 *     <h4>
 *       #{index + 1} — {type === 'house' ? 'Дом' : 'Квартира'}
 *     </h4>
 *   );
 * }
 * ```
 */
export function useFieldArrayItemContext<
  T extends object = Record<string, unknown>,
>(): FieldArrayItemContextValue<T> {
  const context = useContext(FieldArrayItemContext) as FieldArrayItemContextValue<T> | null;
  if (!context) {
    throw new Error(
      'FieldArray.Item* components must be used within FieldArray.List or item template'
    );
  }
  return context;
}
