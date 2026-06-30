import { createElement } from 'react';
import { FormArrayItemContext, useFormArrayContext } from './FormArrayContext';
import type { FormArrayListProps } from './types';

/**
 * FormArray.List - Iterates over array items and provides item context
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.List>
 *   {({ control, index, remove }) => (
 *     <div>
 *       <span>Item #{index + 1}</span>
 *       <button onClick={remove}>Remove</button>
 *       <ItemForm control={control} />
 *     </div>
 *   )}
 * </FormArray.List>
 * ```
 *
 * @example With custom container
 * ```tsx
 * <FormArray.List className="space-y-4" as="ul">
 *   {(item) => <li><ItemForm control={item.control} /></li>}
 * </FormArray.List>
 * ```
 */
export function FormArrayList<T extends object>({
  children,
  className,
  as = 'div',
}: FormArrayListProps<T>) {
  const { items, move } = useFormArrayContext<T>();
  const total = items.length;

  const content = items.map((item) => {
    // Производные хелперы реордера вычисляются здесь (нужна текущая длина), чтобы не раздувать
    // базовую запись item в useFormArray/контексте.
    const enriched = {
      ...item,
      moveUp: () => move(item.index, item.index - 1),
      moveDown: () => move(item.index, item.index + 1),
      canMoveUp: item.index > 0,
      canMoveDown: item.index < total - 1,
    };
    return (
      <FormArrayItemContext.Provider key={item.id} value={enriched}>
        {children(enriched)}
      </FormArrayItemContext.Provider>
    );
  });

  // If no className, render fragment to avoid extra DOM node
  if (!className) {
    return <>{content}</>;
  }

  return createElement(as, { className }, content);
}
