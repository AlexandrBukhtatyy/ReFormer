import { useFormArrayItemContext } from './FormArrayContext';
import type { FormArrayItemIndexProps } from './types';

/**
 * `FormArray.ItemIndex` — выводит номер текущего элемента (должен находиться
 * внутри `FormArray.List` / item-шаблона; читает индекс из
 * {@link FormArrayItemContext}).
 *
 * По умолчанию показывает 1-based номер (`index + 1`) — так удобнее для UI.
 * Проп `render` получает исходный 0-based `index`, поэтому позволяет вывести
 * любую форму (в т.ч. 0-based).
 *
 * @example По умолчанию — 1-based (рендерит 1, 2, 3, …)
 * ```tsx
 * <FormArray.List>
 *   {() => (
 *     <h4>Объект #<FormArray.ItemIndex /></h4>
 *   )}
 * </FormArray.List>
 * ```
 *
 * @example 0-based индекс через render
 * ```tsx
 * <FormArray.ItemIndex render={(index) => index} /> // рендерит 0, 1, 2, …
 * ```
 *
 * @example Кастомный вывод
 * ```tsx
 * <FormArray.ItemIndex render={(index) => `Позиция: ${index + 1}`} />
 * ```
 */
export function FormArrayItemIndex({ render }: FormArrayItemIndexProps) {
  const { index } = useFormArrayItemContext();

  if (render) {
    return <>{render(index)}</>;
  }

  // Default: 1-based display for better UX
  return <>{index + 1}</>;
}
