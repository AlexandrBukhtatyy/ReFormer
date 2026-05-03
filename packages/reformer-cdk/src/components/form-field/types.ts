import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import type { FieldNode, FormValue, ValidationError } from '@reformer/core';

/**
 * Stable IDs for all accessible elements of a form field
 */
export interface FormFieldIds {
  /** ID placed on the interactive control element (<input>, etc.) */
  controlId: string;
  /** ID placed on the <label> element */
  labelId: string;
  /** ID placed on the description paragraph */
  descriptionId: string;
  /** ID placed on the first error paragraph */
  errorId: string;
}

/**
 * Context value provided by FormField.Root
 */
export interface FormFieldContextValue<T extends FormValue = FormValue> {
  // ─── Field state ──────────────────────────────────────────────────────────
  value: T;
  errors: ValidationError[];
  pending: boolean;
  disabled: boolean;
  valid: boolean;
  invalid: boolean;
  touched: boolean;
  shouldShowError: boolean;
  /** First error message, only set when shouldShowError is true */
  error: string | undefined;
  // ─── Derived from componentProps ──────────────────────────────────────────
  label: string | undefined;
  required: boolean;
  /** Full componentProps bag */
  componentProps: Record<string, unknown>;
  // ─── The control itself ───────────────────────────────────────────────────
  control: FieldNode<T>;
  // ─── Accessible IDs ───────────────────────────────────────────────────────
  ids: FormFieldIds;
  /** Whether a FormField.Description is present (drives aria-describedby on Control) */
  hasDescription: boolean;
}

/**
 * Props for FormField.Root
 */
export interface FormFieldRootProps<T extends FormValue = FormValue> {
  /** The FieldNode control from the form */
  control: FieldNode<T>;
  children: ReactNode;
  /** Explicit id prefix; if omitted, useId() is used */
  id?: string;
  /**
   * Set to true when the field has a description element so that
   * FormField.Control automatically wires aria-describedby.
   * Avoids the double-render caused by dynamic description registration.
   * @default false
   */
  hasDescription?: boolean;
}

/**
 * Props for FormField.Label
 */
export interface FormFieldLabelProps extends Omit<
  LabelHTMLAttributes<HTMLLabelElement>,
  'htmlFor'
> {
  /** Render as child element via Slot (merges accessible props into the child) */
  asChild?: boolean;
  /**
   * Override label text. Defaults to componentProps.label.
   * Pass children explicitly when you need custom content inside the label.
   */
  children?: ReactNode;
  /**
   * If true, always renders even when no label text is available.
   * Useful when the consumer provides children.
   * @default false
   */
  forceRender?: boolean;
}

/**
 * Props for FormField.Control
 */
export interface FormFieldControlProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'id' | 'onChange' | 'onBlur'
> {
  /**
   * Merge accessible props into a custom child element instead of
   * auto-rendering control.component.
   */
  asChild?: boolean;
  /**
   * Custom children. When provided, control.component is NOT auto-rendered.
   * Accessible props are merged into the child via Slot.
   */
  children?: ReactNode;
}

/**
 * Props for FormField.Error
 */
export interface FormFieldErrorProps extends Omit<
  HTMLAttributes<HTMLParagraphElement>,
  'id' | 'role'
> {
  asChild?: boolean;
  /**
   * When true, renders all errors instead of only the first.
   * @default false
   */
  multi?: boolean;
  /**
   * Custom render function per error. When provided, multi is implied true.
   */
  render?: (error: ValidationError, index: number) => ReactNode;
  /**
   * Override error content. Defaults to errors[0].message.
   */
  children?: ReactNode;
}

/**
 * Props for FormField.Description
 */
export interface FormFieldDescriptionProps extends Omit<
  HTMLAttributes<HTMLParagraphElement>,
  'id'
> {
  asChild?: boolean;
  children: ReactNode;
}
