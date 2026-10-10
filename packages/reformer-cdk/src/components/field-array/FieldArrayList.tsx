import { createElement } from 'react';
import {
  FieldArrayItemContext,
  useFieldArrayContext,
  type FieldArrayItemContextValue,
} from './FieldArrayContext';
import type { FieldArrayListProps } from './types';

/**
 * FieldArray.List - Iterates over array items and provides item context
 *
 * @example Basic usage
 * ```tsx
 * <FieldArray.List>
 *   {({ control, index, remove }) => (
 *     <div>
 *       <span>Item #{index + 1}</span>
 *       <button onClick={remove}>Remove</button>
 *       <ItemForm control={control} />
 *     </div>
 *   )}
 * </FieldArray.List>
 * ```
 *
 * @example With custom container
 * ```tsx
 * <FieldArray.List className="space-y-4" as="ul">
 *   {(item) => <li><ItemForm control={item.control} /></li>}
 * </FieldArray.List>
 * ```
 */
export function FieldArrayList<T extends object>({
  children,
  className,
  as = 'div',
}: FieldArrayListProps<T>) {
  const { items, move } = useFieldArrayContext<T>();
  const total = items.length;

  const content = items.map((item) => {
    // Производные хелперы реордера вычисляются здесь (нужна текущая длина), чтобы не раздувать
    // базовую запись item в useFieldArray/контексте.
    const enriched = {
      ...item,
      moveUp: () => move(item.index, item.index - 1),
      moveDown: () => move(item.index, item.index + 1),
      canMoveUp: item.index > 0,
      canMoveDown: item.index < total - 1,
    };
    // Контекст хранит generic-erased `<any>` (FormGroup<T> ↛ FormGroup<any>); чтение — через useFieldArrayItemContext<T>().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemContextValue = enriched as FieldArrayItemContextValue<any>;
    return (
      <FieldArrayItemContext.Provider key={item.id} value={itemContextValue}>
        {children(enriched)}
      </FieldArrayItemContext.Provider>
    );
  });

  // If no className, render fragment to avoid extra DOM node
  if (!className) {
    return <>{content}</>;
  }

  return createElement(as, { className }, content);
}
