/**
 * FormWizardActions — кнопки навигации (Назад / Далее → / Отправить).
 *
 * Получает props через render-prop API из `@reformer/cdk/form-wizard`'s
 * `<FormWizard.Actions>` слота. Все user-facing строки опциональные с
 * Russian-дефолтами.
 */

import type { FC } from 'react';
import type { FormWizardActionsRenderProps } from '@reformer/cdk/form-wizard';
import { Button } from '@/components/button';
import { useKitMessages } from '@/i18n/messages';

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
  /**
   * Подпись кнопки «Назад». По умолчанию — из словаря локали.
   * @defaultMessage kit.formWizard.prev
   */
  prevLabel?: string;
  /**
   * Подпись кнопки «Далее». По умолчанию — из словаря локали.
   * @defaultMessage kit.formWizard.next
   */
  nextLabel?: string;
  /**
   * Подпись кнопки отправки на последнем шаге. По умолчанию — из словаря локали.
   * @defaultMessage kit.formWizard.submit
   */
  submitLabel?: string;
  /**
   * Подпись кнопки «Далее» во время валидации шага. По умолчанию — из словаря локали.
   * @defaultMessage kit.formWizard.validating
   */
  validatingLabel?: string;
  /**
   * Подпись кнопки отправки во время submit. По умолчанию — из словаря локали.
   * @defaultMessage kit.formWizard.submitting
   */
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
  prevLabel,
  nextLabel,
  submitLabel,
  validatingLabel,
  submittingLabel,
}) => {
  const t = useKitMessages();
  return (
    <div data-slot="form-wizard-actions" className={`flex gap-4 ${className || ''}`}>
      {!isFirstStep && (
        <Button onClick={prev.onClick} disabled={prev.disabled} data-testid="btn-previous">
          {prevLabel ?? t('kit.formWizard.prev')}
        </Button>
      )}
      <div className="flex-1" />
      {!isLastStep ? (
        <Button onClick={next.onClick} disabled={next.disabled} data-testid="btn-next">
          {isValidating
            ? (validatingLabel ?? t('kit.formWizard.validating'))
            : (nextLabel ?? t('kit.formWizard.next'))}
        </Button>
      ) : (
        <Button onClick={submit.onClick} disabled={submit.disabled} data-testid="btn-submit">
          {isSubmitting
            ? (submittingLabel ?? t('kit.formWizard.submitting'))
            : (submitLabel ?? t('kit.formWizard.submit'))}
        </Button>
      )}
    </div>
  );
};
