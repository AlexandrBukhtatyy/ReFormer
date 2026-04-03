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
 * Hook to access FormArray context
 * @throws Error if used outside of FormArray.Root or RenderSchema ArrayRenderer
 */
export function useFormArrayContext<T extends FormFields = FormFields>(): FormArrayContextValue<T> {
  const context = useContext(FormArrayContext) as FormArrayContextValue<T> | null;
  if (!context) {
    throw new Error(
      'FormArray.* components must be used within FormArray.Root or RenderSchema FormArray'
    );
  }
  return context;
}

/**
 * Hook to access current item context within FormArray.List
 * @throws Error if used outside of FormArray.List or item template
 */
export function useFormArrayItemContext<
  T extends FormFields = FormFields,
>(): FormArrayItemContextValue<T> {
  const context = useContext(FormArrayItemContext) as FormArrayItemContextValue<T> | null;
  if (!context) {
    throw new Error(
      'FormArray.Item* components must be used within FormArray.List or item template'
    );
  }
  return context;
}
