import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import { useIssueMessageResolver } from '../../validation/error-resolver';
import { primaryIssueIndex } from '../../validation/primary-issue';
import type { FormFieldErrorProps } from './types';

/**
 * FormField.Error - Displays validation issue message(s): errors and warnings.
 *
 * Renders nothing when `shouldShowIssues` is false (field not touched or no issues).
 * By default it shows the primary issue: the first error, or the first warning when the field has
 * no errors — issues come in rule order, so a warning may precede an error. The paragraph of the
 * primary issue receives `id={ids.errorId}` for `aria-errormessage` wiring.
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
    // Главное замечание: его текст — в одиночном показе, его элемент несёт id, на который
    // ссылается aria-errormessage контрола, — им должна быть ошибка, а не предупреждение перед ней.
    const primary = primaryIssueIndex(issues);

    if (render) {
      return (
        <>
          {issues.map((err, i) => (
            <Comp
              key={err.code ?? i}
              // forwardRef ref прикрепляем к первому отрисованному элементу, иначе он
              // молча теряется в multi/render-режимах (нарушение контракта forwardRef).
              ref={i === 0 ? ref : undefined}
              id={i === primary ? ids.errorId : undefined}
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
                id={i === primary ? ids.errorId : undefined}
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
        data-severity={severityOf(issues[primary])}
        {...props}
      >
        {children ?? resolve(issues[primary])}
      </Comp>
    );
  }
);

FormFieldError.displayName = 'FormField.Error';
