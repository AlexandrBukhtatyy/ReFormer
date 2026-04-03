/**
 * NavigationActions - компонент кнопок навигации для renderSchema
 *
 * Получает props от FormWizard.Actions через render props.
 */

import type { FC } from 'react';
import type { FormWizardActionsRenderProps } from '@reformer/ui/form-wizard';
import { Button } from '@/components/ui/button';

interface NavigationActionsProps extends FormWizardActionsRenderProps {
  className?: string;
}

export const NavigationActions: FC<NavigationActionsProps> = ({
  prev,
  next,
  submit,
  isFirstStep,
  isLastStep,
  isValidating,
  isSubmitting,
  className,
}) => {
  return (
    <div className={`flex gap-4 ${className || ''}`}>
      {!isFirstStep && (
        <Button onClick={prev.onClick} disabled={prev.disabled} data-testid="btn-previous">
          ← Назад
        </Button>
      )}
      <div className="flex-1" />
      {!isLastStep ? (
        <Button onClick={next.onClick} disabled={next.disabled} data-testid="btn-next">
          {isValidating ? 'Проверка...' : 'Далее →'}
        </Button>
      ) : (
        <Button onClick={submit.onClick} disabled={submit.disabled} data-testid="btn-submit">
          {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
        </Button>
      )}
    </div>
  );
};
