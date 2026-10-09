import { useFieldArrayItemContext } from './FieldArrayContext';
import type { FieldArrayItemIndexProps } from './types';

/**
 * `FieldArray.ItemIndex` — выводит номер текущего элемента (должен находиться
 * внутри `FieldArray.List` / item-шаблона; читает индекс из
 * {@link FieldArrayItemContext}).
 *
 * По умолчанию показывает 1-based номер (`index + 1`) — так удобнее для UI.
 * Проп `render` получает исходный 0-based `index`, поэтому позволяет вывести
 * любую форму (в т.ч. 0-based).
 *
 * @example По умолчанию — 1-based (рендерит 1, 2, 3, …)
 * ```tsx
 * <FieldArray.List>
 *   {() => (
 *     <h4>Объект #<FieldArray.ItemIndex /></h4>
 *   )}
 * </FieldArray.List>
 * ```
 *
 * @example 0-based индекс через render
 * ```tsx
 * <FieldArray.ItemIndex render={(index) => index} /> // рендерит 0, 1, 2, …
 * ```
 *
 * @example Кастомный вывод
 * ```tsx
 * <FieldArray.ItemIndex render={(index) => `Позиция: ${index + 1}`} />
 * ```
 */
export function FieldArrayItemIndex({ render }: FieldArrayItemIndexProps) {
  const { index } = useFieldArrayItemContext();

  if (render) {
    return <>{render(index)}</>;
  }

  // Default: 1-based display for better UX
  return <>{index + 1}</>;
}
