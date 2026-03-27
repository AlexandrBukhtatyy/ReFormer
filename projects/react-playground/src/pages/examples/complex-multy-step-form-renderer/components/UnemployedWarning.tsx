/**
 * UnemployedWarning - предупреждение для безработных
 */

import type { ReactNode } from 'react';

interface UnemployedWarningProps {
  className?: string;
}

export function UnemployedWarning({ className }: UnemployedWarningProps): ReactNode {
  return (
    <div className={className}>
      <p className="text-sm text-yellow-800">
        Обратите внимание: для получения кредита без подтвержденного дохода могут потребоваться
        дополнительные документы и поручители.
      </p>
    </div>
  );
}
