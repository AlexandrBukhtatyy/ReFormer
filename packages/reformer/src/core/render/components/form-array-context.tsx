/**
 * FormArray Context - контекст для передачи состояния массива в дочерние компоненты
 *
 * Этот контекст определён в core и используется как reformer/core, так и reformer-ui.
 *
 * @module core/render/components/form-array-context
 */

import { createContext, useContext } from 'react';
import type { ArrayNode } from '../../nodes/array-node';
import type { FormProxy, FormFields } from '../../types';

/**
 * Представляет элемент массива с контролом, индексом и действиями
 */
export interface FormArrayItem<T extends FormFields> {
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
export interface FormArrayContextValue<T extends FormFields = FormFields> {
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
export interface FormArrayItemContextValue<T extends FormFields = FormFields> {
  /** Контрол для данного элемента */
  control: FormProxy<T>;
  /** Индекс элемента (0-based) */
  index: number;
  /** Уникальный идентификатор для React key */
  id: string | number;
  /** Удалить этот элемент из массива */
  remove: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormArrayContext = createContext<FormArrayContextValue<any> | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormArrayItemContext = createContext<FormArrayItemContextValue<any> | null>(null);

/**
 * Хук для доступа к контексту массива
 *
 * @returns Контекст массива или null если вне FormArray
 */
export function useFormArrayContext<
  T extends FormFields = FormFields,
>(): FormArrayContextValue<T> | null {
  return useContext(FormArrayContext) as FormArrayContextValue<T> | null;
}

/**
 * Хук для доступа к контексту элемента массива
 *
 * @returns Контекст элемента или null если вне item template
 */
export function useFormArrayItemContext<
  T extends FormFields = FormFields,
>(): FormArrayItemContextValue<T> | null {
  return useContext(FormArrayItemContext) as FormArrayItemContextValue<T> | null;
}
