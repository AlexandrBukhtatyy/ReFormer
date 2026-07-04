import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormArrayContext } from './FormArrayContext';
import { useValidationErrorResolver } from '../../validation/error-resolver';
import type { FormArrayErrorProps } from './types';

/**
 * FormArray.Error — рендерит ошибки уровня массива (`control.errors`).
 *
 * Паритет с `FormField.Error`, но для узла массива: показывает array-level ошибки вроде `minItems`
 * / «At least one phone required», которые ядро выставляет через `ArrayNode.setErrors` и агрегирует
 * в сигнале `errors`. Ничего не рендерит, когда ошибок нет. Читает контекст `FormArray.Root`, поэтому
 * консументу больше не нужно обходить CDK через `useFormControl(control)` ради валидации массива.
 *
 * @example Единственная ошибка (по умолчанию)
 * ```tsx
 * <FormArray.Root control={form.phones}>
 *   <FormArray.List>{({ control }) => <PhoneForm control={control} />}</FormArray.List>
 *   <FormArray.Error className="text-xs text-red-600" />
 * </FormArray.Root>
 * ```
 *
 * @example Все ошибки
 * ```tsx
 * <FormArray.Error multi className="text-xs text-red-600" />
 * ```
 *
 * @example Кастомный рендер на ошибку
 * ```tsx
 * <FormArray.Error render={(err) => <span>{err.message}</span>} />
 * ```
 */
export const FormArrayError = forwardRef<HTMLParagraphElement, FormArrayErrorProps>(
  ({ asChild = false, multi = false, render, children, ...props }, ref) => {
    const { errors } = useFormArrayContext();
    // i18n: отображаем результат резолвера (ValidationMessagesProvider), а не сырой error.message.
    const resolve = useValidationErrorResolver();

    if (errors.length === 0) return null;

    const Comp = asChild ? Slot : 'p';

    if (render) {
      return (
        <>
          {errors.map((err, i) => (
            <Comp key={err.code ?? i} role="alert" {...props}>
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
            <Comp key={err.code ?? i} role="alert" {...props}>
              {resolve(err)}
            </Comp>
          ))}
        </>
      );
    }

    return (
      <Comp ref={ref} role="alert" {...props}>
        {children ?? resolve(errors[0])}
      </Comp>
    );
  }
);

FormArrayError.displayName = 'FormArray.Error';
