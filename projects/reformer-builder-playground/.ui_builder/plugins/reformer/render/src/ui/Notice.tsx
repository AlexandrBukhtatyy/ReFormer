/**
 * Плашка «показать нечего» и её причина.
 *
 * Одна на все три поверхности: сообщения разные, а форма ответа одна — заголовок плюс
 * необязательное объяснение. Пустой прямоугольник вместо этого был бы худшим из возможных
 * ответов: он не отличает «схема не разбирается» от «превью сломалось».
 *
 * Действие — когда показать нечего до решения человека: сборка формы остановлена, потому что
 * прошлая не завершилась (`../compiling/inflight`), и продолжить её может только он.
 *
 * @module plugins/reformer/render/ui/Notice
 */

import type { ReactNode } from 'react';
import { Button } from '@reformer/ui-kit/button';

export interface NoticeAction {
  readonly label: string;
  readonly onClick: () => void;
  /** Для тестов и e2e: `data-testid` кнопки. */
  readonly testId?: string;
}

export interface NoticeProps {
  readonly title: string;
  readonly detail?: string;
  readonly tone?: 'neutral' | 'warning';
  readonly action?: NoticeAction;
}

export function Notice({ title, detail, tone = 'neutral', action }: NoticeProps): ReactNode {
  const border = tone === 'warning' ? 'border-amber-400/60' : 'border-border';
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className={`max-w-sm rounded-md border border-dashed ${border} p-4 text-center`}>
        <div className="text-foreground text-[13px] font-medium">{title}</div>
        {detail === undefined ? null : (
          <div className="text-muted-foreground mt-1 text-[12px]">{detail}</div>
        )}
        {action === undefined ? null : (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            data-testid={action.testId}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
