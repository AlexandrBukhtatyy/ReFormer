import type { ComponentType, Ref } from 'react';
import { bindFieldProps, getFieldAdapter } from '@reformer/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

const noop = () => {};

/** Props {@link Bound}: компонент + value-based seam формы + прочие props контрола. */
export type BoundProps = {
  component: ComponentType<any>;
  value?: unknown;
  onChange?: (value: unknown) => void;
  onBlur?: () => void;
  ref?: Ref<unknown>;
} & Record<string, unknown>;

/**
 * Тестовая связка контрола с формой — ровно так, как это делает обёртка поля
 * (`FormField.Control` / рендерер): адаптер из статики `reformerAdapter` + value-based seam.
 * Позволяет проверять компонент «в форме» без FieldNode.
 */
export function Bound({ component: Component, value, onChange, onBlur, ref, ...rest }: BoundProps) {
  const props = bindFieldProps(
    getFieldAdapter(Component),
    { value, onChange: onChange ?? noop, onBlur: onBlur ?? noop },
    rest
  );
  return <Component {...props} {...(ref ? { ref } : {})} />;
}
