import { createElement } from 'react';
import { useList } from './useList';
import {
  ListContext,
  ListItemContext,
  useListContext,
  type ListContextValue,
  type ListItemContextValue,
} from './ListContext';
import type { ListRootProps, ListItemsProps, ListEmptyProps } from './types';

/**
 * List.Root — контекст-провайдер display-списка.
 *
 * Принимает `control` (legacy `ArrayNode` или M1 `ModelArrayNode`) и раздаёт элементы дочерним
 * `List.Items` / `List.Empty`. В отличие от `FormArray.Root` не даёт add/remove/reorder.
 */
function ListRoot<T extends object>({ control, children }: ListRootProps<T>) {
  const state = useList(control);
  // FormProxy<T> ↛ FormProxy<any>; контекст generic-erased, типобезопасность возвращает useListContext<T>().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = state as ListContextValue<any>;
  return <ListContext.Provider value={value}>{children}</ListContext.Provider>;
}

/**
 * List.Items — итерирует элементы и даёт per-item контекст. Render-prop получает `{ control, index, id }`.
 *
 * @example
 * ```tsx
 * <List.Items className="space-y-2">
 *   {({ control }) => <Alert control={control} />}
 * </List.Items>
 * ```
 */
function ListItems<T extends object>({ children, className, as = 'div' }: ListItemsProps<T>) {
  const { items } = useListContext<T>();

  const content = items.map((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemContextValue = item as ListItemContextValue<any>;
    return (
      <ListItemContext.Provider key={item.id} value={itemContextValue}>
        {children(item)}
      </ListItemContext.Provider>
    );
  });

  // Без className — Fragment, чтобы не плодить лишний DOM-узел.
  if (!className) {
    return <>{content}</>;
  }
  return createElement(as, { className }, content);
}

/**
 * List.Empty — рендерит children, только когда список пуст.
 */
function ListEmpty({ children }: ListEmptyProps) {
  const { isEmpty } = useListContext();
  if (!isEmpty) return null;
  return <>{children}</>;
}

type ListComponent = typeof ListRoot & {
  Root: typeof ListRoot;
  Items: typeof ListItems;
  Empty: typeof ListEmpty;
};

/**
 * List — headless compound для display-итерации массива модели.
 *
 * Read-only брат {@link FormArray}: перебирает элементы массива и рендерит на каждый произвольную
 * разметку, БЕЗ кнопок add/remove/reorder. Для списков, которые не редактируются пользователем, а
 * показываются/скрываются через мутацию массива в behavior (например, алерты).
 *
 * ## Sub-components
 * - `List.Root` — контекст-провайдер (принимает `control`)
 * - `List.Items` — итерация элементов (render-prop `{ control, index, id }`)
 * - `List.Empty` — содержимое пустого состояния
 *
 * @example
 * ```tsx
 * <List.Root control={form.alerts}>
 *   <List.Empty><p className="text-gray-400">Нет уведомлений</p></List.Empty>
 *   <List.Items className="space-y-2">
 *     {({ control }) => <Alert control={control} />}
 *   </List.Items>
 * </List.Root>
 * ```
 */
export const List = ListRoot as ListComponent;

List.Root = ListRoot;
List.Items = ListItems;
List.Empty = ListEmpty;
