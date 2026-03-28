/**
 * NavigationActions - компонент кнопок навигации для renderSchema
 *
 * Получает props от FormNavigation.Actions через render props.
 */

import type { FC } from 'react';
import type { FormNavigationActionsRenderProps } from '@reformer/ui/form-navigation';
import { Button } from '@/components/ui/button';

interface NavigationActionsProps extends FormNavigationActionsRenderProps {
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
