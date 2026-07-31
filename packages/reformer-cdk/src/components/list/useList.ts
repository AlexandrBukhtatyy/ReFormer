import { useMemo } from 'react';
import { useFormControl, type ArrayNode } from '@reformer/core';
import type { ListControl, ListItem } from './types';

/**
 * Return type for {@link useList}.
 */
export interface UseListReturn<T extends object> {
  /** Элементы списка с их контролами */
  items: ListItem<T>[];
  /** Текущая длина списка */
  length: number;
  /** Пустой ли список */
  isEmpty: boolean;
}

/**
 * Headless-хук display-итерации массива модели — read-only брат {@link useFormArray}.
 *
 * Реактивно подписывается на длину/значение массива и раскладывает его на элементы
 * `{ control, index, id }`. НЕ отдаёт `add`/`remove`/`move` — для display-списков (например,
 * список алертов), где элементы не редактируются, а появляются/исчезают через мутацию массива в
 * behavior. Ключ `id` берётся из идентичности per-item контрола (`itemControl.id ?? index`), поэтому
 * reorder/фильтрация сохраняют состояние элементов.
 *
 * @example
 * ```tsx
 * function AlertsView({ form }: { form: FormProxy<MyForm> }) {
 *   const { items, isEmpty } = useList(form.alerts);
 *   if (isEmpty) return null;
 *   return (
 *     <div className="space-y-2">
 *       {items.map(({ control, id }) => (
 *         <Alert key={id} control={control} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useList<T extends object>(control: ListControl<T>): UseListReturn<T> {
  // Подписка на length И value: ссылка `value` меняется при add/remove/reorder модели, что
  // заставляет memo пересчитаться (иначе фильтрация/перестановка не отразилась бы в UI).
  // ModelArrayNode структурно совместим с ArrayNode для useFormControl (duck-typed по length/map);
  // cast нужен лишь потому, что перегрузка типизирована строго под ArrayNode.
  const { length, value } = useFormControl(control as ArrayNode<T>);

  const items = useMemo(
    () =>
      control.map((itemControl, index) => ({
        control: itemControl,
        index,
        id: itemControl.id ?? index,
      })),
    // `value` намеренно в deps: его ссылка меняется при любой структурной мутации массива.
    [control, length, value]
  );

  return { items, length, isEmpty: length === 0 };
}
