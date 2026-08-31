/**
 * UnemployedWarning - предупреждение для безработных
 */

import { combineClasses } from '@/utils/combine-classes';
import type { ReactNode } from 'react';

interface UnemployedWarningProps {
  className?: string;
}

export function UnemployedWarning({ className }: UnemployedWarningProps): ReactNode {
  const classes = combineClasses('p-4 bg-yellow-50 border border-yellow-200 rounded-md', className);
  return (
    <div className={classes} data-testid="unemployed-warning">
      <p className="text-sm text-yellow-800">
        Обратите внимание: для получения кредита без подтвержденного дохода могут потребоваться
        дополнительные документы и поручители.
      </p>
    </div>
  );
}
