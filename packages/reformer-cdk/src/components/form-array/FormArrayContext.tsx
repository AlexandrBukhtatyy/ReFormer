/**
 * Re-export FormArray context from core
 *
 * Контекст определён в @reformer/core для обеспечения совместимости
 * между RenderSchema (core) и compound-компонентами (ui).
 */

import { createContext, useContext } from 'react';
import type { ArrayNode, FormFields, FormProxy } from '@reformer/core';

/**
 * Представляет элемент массива с контролом, индексом и действиями
 */
export interface FormArrayItem<T extends object> {
  /** Контрол для данного элемента */
  control: FormProxy<T>;
  /** Индекс элемента (0-based) */
  index: number;
  /** Уникальный идентификатор для React key */
  id: string | number;
  /** Удалить этот элемент из массива */
  remove: () => void;
}

/**
 * Контекст уровня массива
 */
export interface FormArrayContextValue<T extends object = FormFields> {
  /** Массив элементов с контролами и действиями */
  items: FormArrayItem<T>[];
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
  /** Оригинальный ArrayNode */
  control: ArrayNode<T>;
}

/**
 * Контекст уровня элемента массива
 */
export interface FormArrayItemContextValue<T extends object = FormFields> {
  /** Контрол для данного элемента */
  control: FormProxy<T>;
  /** Индекс элемента (0-based) */
  index: number;
  /** Уникальный идентификатор для React key */
  id: string | number;
  /** Удалить этот элемент из массива */
  remove: () => void;
}

/**
 * React context, который снабжает дочерние компоненты `FormArray` (List, AddButton, …)
 * текущим `ArrayNode` и хелперами. Создаётся `FormArray.Root`. Читать через {@link useFormArrayContext}.
 *
 * @example
 * ```tsx
 * import { FormArrayContext } from '@reformer/cdk/form-array';
 *
 * function MyConsumer() {
 *   const ctx = useContext(FormArrayContext);
 *   return <span>items: {ctx?.items.length}</span>;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormArrayContext = createContext<FormArrayContextValue<any> | null>(null);

/**
 * React context, видимый внутри `FormArray.List` для одного элемента массива.
 * Содержит `index`, `path` и `remove()`. Читать через {@link useFormArrayItemContext}.
 *
 * @example
 * ```tsx
 * import { FormArrayItemContext } from '@reformer/cdk/form-array';
 *
 * function CurrentIndex() {
 *   const item = useContext(FormArrayItemContext);
 *   return <small>#{item?.index}</small>;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormArrayItemContext = createContext<FormArrayItemContextValue<any> | null>(null);

/**
 * Хук для доступа к контексту `FormArray`. Бросает исключение, если вызван вне
 * `FormArray.Root` или эквивалентного провайдера.
 *
 * @returns Текущий {@link FormArrayContextValue}.
 * @throws Error если используется вне `FormArray.Root`.
 *
 * @example Кастомный AddButton с predefined значением
 * ```tsx
 * import { useFormArrayContext } from '@reformer/cdk/form-array';
 *
 * function AddDraftButton() {
 *   const { add } = useFormArrayContext<Item>();
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
 *   const { length, isEmpty } = useFormArrayContext();
 *   if (isEmpty) return <span className="text-gray-400">Нет элементов</span>;
 *   return <span className="badge">{length}</span>;
 * }
 * ```
 */
export function useFormArrayContext<T extends object = FormFields>(): FormArrayContextValue<T> {
  const context = useContext(FormArrayContext) as FormArrayContextValue<T> | null;
  if (!context) {
    throw new Error(
      'FormArray.* components must be used within FormArray.Root or RenderSchema FormArray'
    );
  }
  return context;
}

/**
 * Хук для доступа к контексту текущего элемента внутри `FormArray.List`.
 *
 * @returns Текущий {@link FormArrayItemContextValue} (`index`, `path`, `remove`).
 * @throws Error если используется вне `FormArray.List` или item-шаблона.
 *
 * @example Кнопка удаления текущего элемента
 * ```tsx
 * import { useFormArrayItemContext } from '@reformer/cdk/form-array';
 *
 * function ItemRemoveButton() {
 *   const { remove } = useFormArrayItemContext();
 *   return <button onClick={remove}>×</button>;
 * }
 * ```
 *
 * @example Доступ к control + index для условной валидации
 * ```tsx
 * function ItemHeader() {
 *   const { control, index } = useFormArrayItemContext<Property>();
 *   const { value: type } = useFormControl(control.type);
 *   return (
 *     <h4>
 *       #{index + 1} — {type === 'house' ? 'Дом' : 'Квартира'}
 *     </h4>
 *   );
 * }
 * ```
 */
export function useFormArrayItemContext<
  T extends object = FormFields,
>(): FormArrayItemContextValue<T> {
  const context = useContext(FormArrayItemContext) as FormArrayItemContextValue<T> | null;
  if (!context) {
    throw new Error(
      'FormArray.Item* components must be used within FormArray.List or item template'
    );
  }
  return context;
}
