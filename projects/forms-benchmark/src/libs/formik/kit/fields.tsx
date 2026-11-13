/**
 * Formik ↔ shared primitives: reusable input components, as the Formik tutorial recommends («you
 * can and should build reusable input primitive components»). Each view renders the contract's
 * `FieldFrame` around one shared control from a `Bound` field (`./binding`). The components below
 * bind a view with `useField` (`useBenchField`); `FastBenchField` puts the same views in `<FastField>`.
 * Number and captcha views live in their own modules (`./number`, `./captcha`) so that each form's
 * bundle imports only its own domain.
 */
import type { ComponentProps, JSXElementConstructor } from 'react';
import { FastField, type FieldProps } from 'formik';
import { FieldFrame, controlAttrs } from '../../../shared/ui/FieldFrame';
import {
  Checkbox,
  DateInput,
  MaskedInput,
  RadioGroup,
  ReadonlyValue,
  Select,
  TextInput,
  Textarea,
} from '../../../shared/ui/controls';
import { useBenchField, type Bound } from './binding';

/** Props that the binding supplies. */
export type BoundKeys = 'name' | 'value' | 'checked' | 'onChange' | 'onBlur';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any component, as in React's own ComponentProps
export type ViewProps<C extends JSXElementConstructor<any>> = { label: string } & Omit<
  ComponentProps<C>,
  BoundKeys
>;

// ── Views: Bound field → FieldFrame + shared control ─────────────────────────
export function textView(b: Bound<string>, { label, ...props }: ViewProps<typeof TextInput>) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <TextInput {...props} {...b.field} {...controlAttrs(b.path, b.error)} />
    </FieldFrame>
  );
}

export function textareaView(b: Bound<string>, { label, ...props }: ViewProps<typeof Textarea>) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <Textarea {...props} {...b.field} {...controlAttrs(b.path, b.error)} />
    </FieldFrame>
  );
}

export function maskedView(b: Bound<string>, { label, ...props }: ViewProps<typeof MaskedInput>) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <MaskedInput {...props} {...b.field} {...controlAttrs(b.path, b.error)} />
    </FieldFrame>
  );
}

export function dateView(b: Bound<string>, { label, ...props }: ViewProps<typeof DateInput>) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <DateInput {...props} {...b.field} {...controlAttrs(b.path, b.error)} />
    </FieldFrame>
  );
}

export function selectView(b: Bound<string>, { label, ...props }: ViewProps<typeof Select>) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <Select {...props} {...b.field} {...controlAttrs(b.path, b.error)} />
    </FieldFrame>
  );
}

/** `RadioGroup` reads `event.target.name/value`, so Formik's `handleChange` binds it as is. */
export function radioView(b: Bound<string>, { label, ...props }: ViewProps<typeof RadioGroup>) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <RadioGroup {...props} {...b.field} {...controlAttrs(b.path, b.error)} />
    </FieldFrame>
  );
}

/** Bound with `type: 'checkbox'`: Formik gives `field.checked` and keeps a boolean value. */
export function checkboxView(b: Bound<boolean>, { label, ...props }: ViewProps<typeof Checkbox>) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error} inline>
      <Checkbox
        {...props}
        name={b.field.name}
        checked={b.field.checked}
        onChange={b.field.onChange}
        onBlur={b.field.onBlur}
        {...controlAttrs(b.path, b.error)}
      />
    </FieldFrame>
  );
}

// ── useField components (registration) ──────────────────────────────────────
interface Named {
  name: string;
}

export function TextField({ name, ...props }: Named & ViewProps<typeof TextInput>) {
  return textView(useBenchField<string>(name), props);
}

export function MaskedField({ name, ...props }: Named & ViewProps<typeof MaskedInput>) {
  return maskedView(useBenchField<string>(name), props);
}

export function CheckboxField({ name, ...props }: Named & ViewProps<typeof Checkbox>) {
  return checkboxView(useBenchField<boolean>({ name, type: 'checkbox' }), props);
}

// ── Computed value ───────────────────────────────────────────────────────────
/**
 * Read-only computed value kept in Formik `values`: `<FastField>` re-renders it only when this
 * value changes.
 */
export function ComputedField({ name, label }: Named & { label: string }) {
  return (
    <FastField name={name}>
      {({ field }: FieldProps<string | number | null>) => (
        <ReadonlyValue path={name} label={label} value={field.value} />
      )}
    </FastField>
  );
}
