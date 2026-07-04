import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import { useValidationErrorResolver } from '../../validation/error-resolver';
import type { FormFieldErrorProps } from './types';

/**
 * FormField.Error - Displays validation error message(s).
 *
 * Renders nothing when `shouldShowError` is false (field not touched or no errors).
 * The first error paragraph receives `id={ids.errorId}` for `aria-errormessage` wiring.
 *
 * @example Single error (default)
 * ```tsx
 * <FormField.Error className="text-xs text-red-600" />
 * ```
 *
 * @example All errors
 * ```tsx
 * <FormField.Error multi className="text-xs text-red-600" />
 * ```
 *
 * @example Custom render per error
 * ```tsx
 * <FormField.Error
 *   render={(err) => (
 *     <span className={err.severity === 'warning' ? 'text-yellow-600' : 'text-red-600'}>
 *       {err.message}
 *     </span>
 *   )}
 * />
 * ```
 *
 * @example Custom error content
 * ```tsx
 * <FormField.Error className="text-xs">
 *   This field is required
 * </FormField.Error>
 * ```
 */
export const FormFieldError = forwardRef<HTMLParagraphElement, FormFieldErrorProps>(
  ({ asChild = false, multi = false, render, children, ...props }, ref) => {
    const { shouldShowError, errors, ids } = useFormFieldContext();
    // i18n: отображаем результат резолвера (ValidationMessagesProvider), а не сырой error.message.
    const resolve = useValidationErrorResolver();

    if (!shouldShowError || errors.length === 0) return null;

    const Comp = asChild ? Slot : 'p';

    if (render) {
      return (
        <>
          {errors.map((err, i) => (
            <Comp
              key={err.code ?? i}
              id={i === 0 ? ids.errorId : undefined}
              role="alert"
              {...props}
            >
              {render(err, i)}
            </Comp>
          ))}
        </>
      );
    }

    if (multi) {
      return (
        <>
          {errors.map((err, i) => (
            <Comp
              key={err.code ?? i}
              id={i === 0 ? ids.errorId : undefined}
              role="alert"
              {...props}
            >
              {resolve(err)}
            </Comp>
          ))}
        </>
      );
    }

    return (
      <Comp ref={ref} id={ids.errorId} role="alert" {...props}>
        {children ?? resolve(errors[0])}
      </Comp>
    );
  }
);

FormFieldError.displayName = 'FormField.Error';
