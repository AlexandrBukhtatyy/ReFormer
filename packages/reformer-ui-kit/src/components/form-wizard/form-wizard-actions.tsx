/**
 * FormWizardActions — кнопки навигации (Назад / Далее → / Отправить).
 *
 * Получает props через render-prop API из `@reformer/cdk/form-wizard`'s
 * `<FormWizard.Actions>` слота. Все user-facing строки опциональные с
 * Russian-дефолтами.
 */

import type { FC } from 'react';
import type { FormWizardActionsRenderProps } from '@reformer/cdk/form-wizard';
import { Button } from '../ui/button';

/**
 * Пропсы {@link FormWizardActions}: render-props навигации из headless-слота
 * `<FormWizard.Actions>` (`prev`, `next`, `submit`, `isFirstStep`, `isLastStep`,
 * `isValidating`, `isSubmitting`) плюс переопределяемые подписи кнопок.
 *
 * Все `*Label`-пропсы опциональны и имеют русские дефолты.
 */
export interface FormWizardActionsProps extends FormWizardActionsRenderProps {
  /** Внешний CSS-класс контейнера кнопок. */
  className?: string;
  /** Подпись кнопки «Назад». По умолчанию `'← Назад'`. */
  prevLabel?: string;
  /** Подпись кнопки «Далее». По умолчанию `'Далее →'`. */
  nextLabel?: string;
  /** Подпись кнопки отправки на последнем шаге. По умолчанию `'Отправить заявку'`. */
  submitLabel?: string;
  /** Подпись кнопки «Далее» во время валидации шага. По умолчанию `'Проверка...'`. */
  validatingLabel?: string;
  /** Подпись кнопки отправки во время submit. По умолчанию `'Отправка...'`. */
  submittingLabel?: string;
}

/**
 * Кнопки навигации wizard'а: «Назад» / «Далее →» / «Отправить». На первом шаге
 * скрывает «Назад», на последнем показывает «Отправить» вместо «Далее». Во время
 * валидации/отправки показывает промежуточные подписи и блокирует кнопку.
 *
 * Рендерится из headless-слота `<FormWizard.Actions>` через render-prop, поэтому
 * `prev`/`next`/`submit`/флаги приходят автоматически. Готовый {@link FormWizard}
 * уже подключает этот компонент — использовать напрямую нужно только для кастомной
 * раскладки.
 *
 * @example Кастомные подписи в слоте Actions
 * ```tsx
 * <FormWizard.Actions onSubmit={onSubmit}>
 *   {(actions) => (
 *     <FormWizardActions
 *       {...actions}
 *       submitLabel="Оформить заявку"
 *       className="mt-8"
 *     />
 *   )}
 * </FormWizard.Actions>
 * ```
 */
export const FormWizardActions: FC<FormWizardActionsProps> = ({
  prev,
  next,
  submit,
  isFirstStep,
  isLastStep,
  isValidating,
  isSubmitting,
  className,
  prevLabel = '← Назад',
  nextLabel = 'Далее →',
  submitLabel = 'Отправить заявку',
  validatingLabel = 'Проверка...',
  submittingLabel = 'Отправка...',
}) => {
  return (
    <div className={`flex gap-4 ${className || ''}`}>
      {!isFirstStep && (
        <Button onClick={prev.onClick} disabled={prev.disabled} data-testid="btn-previous">
          {prevLabel}
        </Button>
      )}
      <div className="flex-1" />
      {!isLastStep ? (
        <Button onClick={next.onClick} disabled={next.disabled} data-testid="btn-next">
          {isValidating ? validatingLabel : nextLabel}
        </Button>
      ) : (
        <Button onClick={submit.onClick} disabled={submit.disabled} data-testid="btn-submit">
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      )}
    </div>
  );
};
