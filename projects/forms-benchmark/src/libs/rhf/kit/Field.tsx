/**
 * Glue between React Hook Form and the shared `FieldFrame` (BENCH-CONTRACT §4).
 *
 * Each field subscribes to its own error only — `useFormState({ name })` for `register`ed
 * inputs, `useController` for value-based widgets — so an error change re-renders that one field,
 * not the form (docs: "Isolating form subscriptions", "FormProvider performance").
 */
import type { ReactNode } from 'react';
import {
  get,
  useController,
  useFormState,
  type Control,
  type ControllerRenderProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { FieldFrame, controlAttrs } from '../../../shared/ui/FieldFrame';

export type ControlAttrs = ReturnType<typeof controlAttrs>;

/** DOM-contract path of a field name: `personalData.lastName` → `personalData-lastName`. */
export const domPath = (name: string): string => name.replaceAll('.', '-');

interface FieldBaseProps<TValues extends FieldValues, TName extends FieldPath<TValues>> {
  control: Control<TValues>;
  name: TName;
  label: string;
  /** Label to the right of the control (checkbox). */
  inline?: boolean;
}

/**
 * Frame for an uncontrolled input bound with `register`. The caller spreads `register(name)` on the
 * control; this component adds the frame, the error and the contract attributes (`attrs`).
 */
export function Field<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  label,
  inline,
  children,
}: FieldBaseProps<TValues, TName> & { children: (attrs: ControlAttrs) => ReactNode }) {
  const { errors } = useFormState({ control, name, exact: true });
  const error: FieldError | undefined = get(errors, name);
  const path = domPath(name);
  return (
    <FieldFrame path={path} label={label} error={error?.message} inline={inline}>
      {children(controlAttrs(path, error?.message))}
    </FieldFrame>
  );
}

/**
 * Frame for a value-based widget (`value` / `onChange(value)`), bound with `useController`.
 * The caller maps `field` (value, onChange, onBlur, ref, name) onto the widget's props.
 */
export function ControllerField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  label,
  inline,
  children,
}: FieldBaseProps<TValues, TName> & {
  children: (field: ControllerRenderProps<TValues, TName>, attrs: ControlAttrs) => ReactNode;
}) {
  const { field, fieldState } = useController({ control, name });
  const error = fieldState.error?.message;
  const path = domPath(name);
  return (
    <FieldFrame path={path} label={label} error={error} inline={inline}>
      {children(field, controlAttrs(path, error))}
    </FieldFrame>
  );
}
