import type { ReactNode } from 'react';

export interface LoadingStateProps {
  /** Основной текст. По умолчанию `'Загрузка данных...'`. */
  title?: string;
  /** Вспомогательный текст под спиннером. По умолчанию `'Пожалуйста, подождите'`. */
  subtitle?: string;
  /** Внешний CSS-класс контейнера. По умолчанию центрирует спиннер с отступами. */
  className?: string;
}

/**
 * Состояние загрузки — центрированный спиннер с заголовком и подзаголовком.
 * Типовое применение — показать вместо формы, пока грузятся данные заявки.
 *
 * @param props - Пропсы: `title`, `subtitle`, `className` (все опциональны).
 * @returns Разметку блока загрузки.
 *
 * @example Загрузка перед рендером формы
 * ```tsx
 * const { isLoading } = useLoadCreditApplication(form, '1');
 * if (isLoading) {
 *   return <LoadingState />;
 * }
 * ```
 */
export function LoadingState({
  title = 'Загрузка данных...',
  subtitle = 'Пожалуйста, подождите',
  className,
}: LoadingStateProps): ReactNode {
  return (
    <div
      data-testid="loading-state"
      role="status"
      aria-live="polite"
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
