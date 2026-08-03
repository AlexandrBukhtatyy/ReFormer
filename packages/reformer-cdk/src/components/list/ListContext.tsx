import { createContext, useContext } from 'react';
import type { ListItem } from './types';

/**
 * Контекст уровня списка. Read-only: только `items` + производные (`length`/`isEmpty`), без
 * мутационных действий (ср. {@link FormArrayContextValue}).
 */
export interface ListContextValue<T extends object = Record<string, unknown>> {
  /** Элементы списка с их контролами */
  items: ListItem<T>[];
  /** Текущая длина списка */
  length: number;
  /** Пустой ли список */
  isEmpty: boolean;
}

/**
 * Контекст уровня элемента внутри {@link List.Items}.
 */
export type ListItemContextValue<T extends object = Record<string, unknown>> = ListItem<T>;

/**
 * React-контекст, снабжающий дочерние компоненты `List` (`Items`/`Empty`) текущими элементами.
 * Создаётся `List.Root`. Читать через {@link useListContext}.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ListContext = createContext<ListContextValue<any> | null>(null);

/**
 * React-контекст текущего элемента, видимый внутри `List.Items`. Читать через
 * {@link useListItemContext}.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ListItemContext = createContext<ListItemContextValue<any> | null>(null);

/**
 * Доступ к контексту `List`. Бросает вне `List.Root`.
 */
export function useListContext<T extends object = Record<string, unknown>>(): ListContextValue<T> {
  const context = useContext(ListContext) as ListContextValue<T> | null;
  if (!context) {
    throw new Error('List.* components must be used within List.Root');
  }
  return context;
}

/**
 * Доступ к контексту текущего элемента внутри `List.Items`. Бросает вне `List.Items`.
 */
export function useListItemContext<
  T extends object = Record<string, unknown>,
>(): ListItemContextValue<T> {
  const context = useContext(ListItemContext) as ListItemContextValue<T> | null;
  if (!context) {
    throw new Error('List item components must be used within List.Items');
  }
  return context;
}
