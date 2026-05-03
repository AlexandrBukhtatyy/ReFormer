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

export interface FormWizardActionsProps extends FormWizardActionsRenderProps {
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
  validatingLabel?: string;
  submittingLabel?: string;
}

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
