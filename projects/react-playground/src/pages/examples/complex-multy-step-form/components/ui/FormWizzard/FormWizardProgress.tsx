/**
 * FormWizardProgress - компонент прогресса для renderSchema
 *
 * Получает props от FormWizard.Progress через render props.
 */

import type { FC } from 'react';
import type { FormWizardProgressRenderProps } from '@reformer/ui/form-wizard';
import { combineClasses } from '@/utils/combine-classes';

interface FormWizardProgressProps extends FormWizardProgressRenderProps {
  className?: string;
}

export const FormWizardProgress: FC<FormWizardProgressProps> = ({
  current,
  total,
  percent,
  className,
}) => {
  const classes = combineClasses('text-center text-sm text-gray-600', className);
  return (
    <div className={classes}>
      Шаг {current} из {total} • {percent}% завершено
    </div>
  );
};
