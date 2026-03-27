/**
 * NavigationProgress - компонент прогресса для renderSchema
 *
 * Получает props от FormNavigation.Progress через render props.
 */

import type { FC } from 'react';
import type { FormNavigationProgressRenderProps } from '@reformer/ui/form-navigation';

interface NavigationProgressProps extends FormNavigationProgressRenderProps {
  className?: string;
}

export const NavigationProgress: FC<NavigationProgressProps> = ({
  current,
  total,
  percent,
  className,
}) => {
  return (
    <div className={`text-sm text-gray-600 ${className || ''}`}>
      Шаг {current} из {total} • {percent}% завершено
    </div>
  );
};
