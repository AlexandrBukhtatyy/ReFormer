import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import { useIssueMessageResolver } from '../../validation/error-resolver';
import type { FormFieldErrorProps } from './types';

/**
 * FormField.Error - Displays validation issue message(s): errors and warnings.
 *
 * Renders nothing when `shouldShowIssues` is false (field not touched or no issues).
 * The first paragraph receives `id={ids.errorId}` for `aria-errormessage` wiring.
 * A warning (`severity: 'warning'`) is rendered with `data-severity="warning"` for styling.
 *
 * @example Single error (default)
 * ```tsx
 * <FormField.Error className="text-xs text-red-600" />
 * ```
 *
 * @example All issues
 * ```tsx
 * <FormField.Error multi className="text-xs text-red-600" />
 * ```
 *
 * @example Custom render per error
 * ```tsx
 * const resolve = useIssueMessageResolver(); // текст замечания по коду
 *
 * <FormField.Error
 *   render={(issue) => (
 *     <span className={issue.severity === 'warning' ? 'text-yellow-600' : 'text-red-600'}>
 *       {resolve(issue)}
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
    const { shouldShowIssues, issues, ids } = useFormFieldContext();
    // i18n: отображаем результат резолвера (ValidationMessagesProvider), а не сырой error.message.
    const resolve = useIssueMessageResolver();

    if (!shouldShowIssues || issues.length === 0) return null;

    const Comp = asChild ? Slot : 'p';
    // Предупреждение помечается атрибутом — стилю есть за что зацепиться; у ошибки DOM прежний.
    const severityOf = (issue: (typeof issues)[number]): 'warning' | undefined =>
      issue.severity === 'warning' ? 'warning' : undefined;

    if (render) {
      return (
        <>
          {issues.map((err, i) => (
            <Comp
              key={err.code ?? i}
              // forwardRef ref прикрепляем к первому отрисованному элементу, иначе он
              // молча теряется в multi/render-режимах (нарушение контракта forwardRef).
              ref={i === 0 ? ref : undefined}
              id={i === 0 ? ids.errorId : undefined}
              role="alert"
              data-severity={severityOf(err)}
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
          {issues.map((err, i) => {
            // asChild + multi: у Slot нет пользовательского дочернего элемента (каждая
            // ошибка — строка резолвера), а Slot требует валидный ReactElement и иначе
            // рендерит null → раньше `<FormField.Error asChild multi/>` не показывал
            // ничего. Оборачиваем строку в <span>, чтобы Slot смёржил в него a11y-пропсы.
            const content = resolve(err);
            return (
              <Comp
                key={err.code ?? i}
                ref={i === 0 ? ref : undefined}
                id={i === 0 ? ids.errorId : undefined}
                role="alert"
                data-severity={severityOf(err)}
                {...props}
              >
                {asChild ? <span>{content}</span> : content}
              </Comp>
            );
          })}
        </>
      );
    }

    return (
      <Comp
        ref={ref}
        id={ids.errorId}
        role="alert"
        data-severity={severityOf(issues[0])}
        {...props}
      >
        {children ?? resolve(issues[0])}
      </Comp>
    );
  }
);

FormFieldError.displayName = 'FormField.Error';
