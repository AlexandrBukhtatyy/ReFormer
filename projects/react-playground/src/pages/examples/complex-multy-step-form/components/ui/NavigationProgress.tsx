/**
 * NavigationProgress - компонент прогресса для renderSchema
 *
 * Получает props от FormNavigation.Progress через render props.
 */

import type { FC } from 'react';
import type { FormNavigationProgressRenderProps } from '@reformer/ui/form-navigation';
import { combineClasses } from '@/utils/combine-classes';

interface NavigationProgressProps extends FormNavigationProgressRenderProps {
  className?: string;
}

export const NavigationProgress: FC<NavigationProgressProps> = ({
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
