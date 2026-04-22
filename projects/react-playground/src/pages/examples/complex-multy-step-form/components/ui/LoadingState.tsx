import type { ReactNode } from 'react';

interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function LoadingState({
  title = 'Загрузка данных...',
  subtitle = 'Пожалуйста, подождите',
  className,
}: LoadingStateProps): ReactNode {
  return (
    <div
      data-testid="loading-state"
      className={className ?? 'w-full flex items-center justify-center p-12'}
    >
      <div className="text-center space-y-4">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <div className="text-lg text-gray-600">{title}</div>
        <div className="text-sm text-gray-500">{subtitle}</div>
      </div>
    </div>
  );
}
