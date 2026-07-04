import {
  Children,
  cloneElement,
  isValidElement,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  type Ref,
  type RefCallback,
  type ReactElement,
} from 'react';

/** Композиция нескольких ref в один: forwarded И child ref получают узел (иначе один молча теряется). */
function composeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref != null) (ref as { current: T | null }).current = node;
    }
  };
}

/**
 * Merges slot props with child props.
 * - Event handlers are chained (child first, then slot)
 * - className is concatenated
 * - style is merged (slot overrides child)
 * - disabled uses OR logic (either true = true)
 * - Other props: child takes precedence
 */
function mergeProps(
  slotProps: Record<string, unknown>,
  childProps: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...slotProps };

  for (const key of Object.keys(childProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];

    // Merge event handlers (child first, then slot)
    if (
      key.startsWith('on') &&
      typeof slotValue === 'function' &&
      typeof childValue === 'function'
    ) {
      merged[key] = (...args: unknown[]) => {
        (childValue as (...args: unknown[]) => void)(...args);
        (slotValue as (...args: unknown[]) => void)(...args);
      };
    }
    // Merge className
    else if (
      key === 'className' &&
      typeof slotValue === 'string' &&
      typeof childValue === 'string'
    ) {
      merged[key] = [childValue, slotValue].filter(Boolean).join(' ');
    }
    // Merge style (slot overrides child)
    else if (key === 'style' && typeof slotValue === 'object' && typeof childValue === 'object') {
      merged[key] = { ...(childValue as object), ...(slotValue as object) };
    }
    // Merge disabled (OR logic)
    else if (key === 'disabled') {
      merged[key] = Boolean(slotValue) || Boolean(childValue);
    }
    // Child value takes precedence for other props
    else if (childValue !== undefined) {
      merged[key] = childValue;
    }
  }

  return merged;
}

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

/**
 * Slot component for asChild pattern.
 *
 * Renders its child element and merges props from the Slot into the child.
 * Used to allow custom components to be rendered in place of default elements.
 *
 * @example
 * ```tsx
 * // Instead of rendering a button, renders MyButton with merged props
 * <Slot onClick={handleClick} disabled={true}>
 *   <MyButton className="custom">Click me</MyButton>
 * </Slot>
 * // Result: <MyButton onClick={handleClick} disabled={true} className="custom">Click me</MyButton>
 * ```
 *
 * @internal Внутренняя утилита form-wizard (asChild для кнопок Prev/Next/Submit);
 * намеренно не выведена в главный `index.ts`.
 */
export const Slot = forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, forwardedRef) => {
    const child = Children.only(children);

    if (!isValidElement(child)) {
      return null;
    }

    const childProps = child.props as Record<string, unknown>;
    const mergedProps = mergeProps(slotProps, childProps);

    // Handle ref merging: композируем forwarded + child ref (оба получают узел), а не берём один.
    const childRef = (child as ReactElement & { ref?: Ref<unknown> }).ref;
    const mergedRef = composeRefs(forwardedRef, childRef);

    return cloneElement(child, {
      ...mergedProps,
      ref: mergedRef,
    } as Record<string, unknown>);
  }
);

Slot.displayName = 'Slot';
