import { forwardRef } from 'react';
import type React from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import type { FormFieldControlProps } from './types';

/**
 * FormField.Control - Renders the interactive form control.
 *
 * **Auto-render mode** (default): renders `control.component` with all necessary
 * props pre-wired: `value`, `onChange`, `onBlur`, `disabled`, `aria-*` attributes,
 * and all `componentProps` from the field config.
 *
 * **Custom children mode** (`asChild` or `children`): merges accessible props
 * into the provided child element via Slot, letting you use any custom component.
 *
 * @example Auto-render (renders control.component)
 * ```tsx
 * <FormField.Root control={control.email}>
 *   <FormField.Label />
 *   <FormField.Control />
 * </FormField.Root>
 * ```
 *
 * @example Custom input with asChild (merges aria-* into your element)
 * ```tsx
 * <FormField.Control asChild>
 *   <MyInput type="email" className="custom-input" />
 * </FormField.Control>
 * ```
 *
 * @example Custom children (same as asChild)
 * ```tsx
 * <FormField.Control>
 *   <MyInput type="email" />
 * </FormField.Control>
 * ```
 */
export const FormFieldControl = forwardRef<HTMLElement, FormFieldControlProps>(
  ({ asChild = false, children, ...props }, ref) => {
    const {
      control,
      value,
      disabled,
      shouldShowError,
      errors,
      required,
      ids,
      hasDescription,
      componentProps,
    } = useFormFieldContext();

    const ariaDescribedBy =
      [
        hasDescription ? ids.descriptionId : null,
        shouldShowError && errors.length > 0 ? ids.errorId : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined;

    const accessibleProps = {
      id: ids.controlId,
      'aria-labelledby': ids.labelId,
      'aria-invalid': shouldShowError ? (true as const) : undefined,
      'aria-describedby': ariaDescribedBy,
      'aria-errormessage': shouldShowError && errors.length > 0 ? ids.errorId : undefined,
      'aria-required': required ? (true as const) : undefined,
    };

    if (children || asChild) {
      return (
        <Slot ref={ref} {...(accessibleProps as Record<string, unknown>)} {...props}>
          {children}
        </Slot>
      );
    }

    const Component = control.component as React.ComponentType<Record<string, unknown>>;
    // `testId` — мета-проп поля: его потребляет FormField для генерации `data-testid`
    // (field/label/input/error). В DOM-контрол его пробрасывать нельзя (React-варнинг
    // «unknown prop testId»), поэтому исключаем из spread componentProps.
    const { testId: _testId, ...domComponentProps } = (componentProps ?? {}) as Record<
      string,
      unknown
    >;
    void _testId;
    return (
      <Component
        ref={ref}
        {...domComponentProps}
        {...(accessibleProps as Record<string, unknown>)}
        {...(props as Record<string, unknown>)}
        value={value}
        disabled={disabled}
        onChange={(v: unknown) => control.setValue(v as never)}
        onBlur={() => control.markAsTouched()}
      />
    );
  }
);

FormFieldControl.displayName = 'FormField.Control';
