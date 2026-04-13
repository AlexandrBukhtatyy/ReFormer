import type { ReactNode } from 'react';
import { Button } from '@reformer/ui-kit';

interface ErrorStateProps {
  error: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  error,
  title = 'Ошибка загрузки',
  onRetry,
  retryLabel = 'Попробовать снова',
  className,
}: ErrorStateProps): ReactNode {
  return (
    <div className={className ?? 'w-full'}>
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-4">
        <div className="text-red-600 text-5xl">!</div>
        <div className="text-xl font-semibold text-red-800">{title}</div>
        <div className="text-red-700">{error}</div>
        {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
      </div>
    </div>
  );
}
