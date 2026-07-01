import type { ReactNode } from 'react';
import { Button } from '../ui/button';

interface ErrorStateProps {
  /** Текст ошибки, показывается под заголовком. */
  error: string;
  /** Заголовок блока ошибки. По умолчанию `'Ошибка загрузки'`. */
  title?: string;
  /** Колбэк повторной попытки. Если задан — рендерится кнопка «Повторить». */
  onRetry?: () => void;
  /** Подпись кнопки повтора. По умолчанию `'Повторить'`. */
  retryLabel?: string;
  /** Внешний CSS-класс контейнера. По умолчанию `'w-full'`. */
  className?: string;
}

/**
 * Состояние ошибки — карточка с иконкой, заголовком, текстом ошибки и
 * опциональной кнопкой повтора. Типовое применение — показать вместо формы,
 * когда не удалось загрузить данные заявки.
 *
 * @param props - Пропсы: `error` (обязателен), `title`, `onRetry`, `retryLabel`, `className`.
 * @returns Разметку блока ошибки.
 *
 * @example Ошибка загрузки с повтором
 * ```tsx
 * const { error } = useLoadCreditApplication(form, '1');
 * if (error) {
 *   return <ErrorState error={error} onRetry={() => window.location.reload()} />;
 * }
 * ```
 */
export function ErrorState({
  error,
  title = 'Ошибка загрузки',
  onRetry,
  retryLabel = 'Повторить',
  className,
}: ErrorStateProps): ReactNode {
  return (
    <div data-testid="error-state" className={className ?? 'w-full'}>
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-4">
        <div className="text-red-600 text-5xl">!</div>
        <div className="text-xl font-semibold text-red-800">{title}</div>
        <div className="text-red-700">{error}</div>
        {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
      </div>
    </div>
  );
}
