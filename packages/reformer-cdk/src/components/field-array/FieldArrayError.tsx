import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFieldArrayContext } from './FieldArrayContext';
import { useValidationErrorResolver } from '../../validation/error-resolver';
import type { FieldArrayErrorProps } from './types';

/**
 * FieldArray.Error — рендерит ошибки уровня массива (`control.errors`).
 *
 * Паритет с `FormField.Error`, но для узла массива: показывает array-level ошибки вроде `minItems`
 * / «At least one phone required», которые ядро выставляет через `ArrayNode.setErrors` и агрегирует
 * в сигнале `errors`. Ничего не рендерит, когда ошибок нет. Читает контекст `FieldArray.Root`, поэтому
 * консументу больше не нужно обходить CDK через `useFormControl(control)` ради валидации массива.
 *
 * @example Единственная ошибка (по умолчанию)
 * ```tsx
 * <FieldArray.Root control={form.phones}>
 *   <FieldArray.List>{({ control }) => <PhoneForm control={control} />}</FieldArray.List>
 *   <FieldArray.Error className="text-xs text-red-600" />
 * </FieldArray.Root>
 * ```
 *
 * @example Все ошибки
 * ```tsx
 * <FieldArray.Error multi className="text-xs text-red-600" />
 * ```
 *
 * @example Кастомный рендер на ошибку
 * ```tsx
 * <FieldArray.Error render={(err) => <span>{err.message}</span>} />
 * ```
 */
export const FieldArrayError = forwardRef<HTMLParagraphElement, FieldArrayErrorProps>(
  ({ asChild = false, multi = false, render, children, ...props }, ref) => {
    const { errors } = useFieldArrayContext();
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

FieldArrayError.displayName = 'FieldArray.Error';
