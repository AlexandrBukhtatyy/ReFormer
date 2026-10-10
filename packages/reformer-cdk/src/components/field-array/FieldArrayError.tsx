import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFieldArrayContext } from './FieldArrayContext';
import { useIssueMessageResolver } from '../../validation/error-resolver';
import type { FieldArrayErrorProps } from './types';

/**
 * FieldArray.Error — рендерит ошибки уровня массива (`control.issues`).
 *
 * Паритет с `FormField.Error`, но для узла массива: показывает array-level ошибки вроде `minItems`
 * / «At least one phone required», которые правила массива выставляют через `FormArray.setIssues` и агрегирует
 * в сигнале `issues`. Ничего не рендерит, когда ошибок нет. Читает контекст `FieldArray.Root`, поэтому
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
 * const resolve = useIssueMessageResolver(); // текст замечания по коду
 *
 * <FieldArray.Error render={(issue) => <span>{resolve(issue)}</span>} />
 * ```
 */
export const FieldArrayError = forwardRef<HTMLParagraphElement, FieldArrayErrorProps>(
  ({ asChild = false, multi = false, render, children, ...props }, ref) => {
    const { issues } = useFieldArrayContext();
    // i18n: отображаем результат резолвера (ValidationMessagesProvider), а не сырой error.message.
    const resolve = useIssueMessageResolver();

    if (issues.length === 0) return null;

    const Comp = asChild ? Slot : 'p';

    if (render) {
      return (
        <>
          {issues.map((err, i) => (
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
          {issues.map((err, i) => (
            <Comp key={err.code ?? i} role="alert" {...props}>
              {resolve(err)}
            </Comp>
          ))}
        </>
      );
    }

    return (
      <Comp ref={ref} role="alert" {...props}>
        {children ?? resolve(issues[0])}
      </Comp>
    );
  }
);

FieldArrayError.displayName = 'FieldArray.Error';
