/**
 * Действия панели шаблонов в шапке дока: перечитать список.
 *
 * Кнопка ЗНАЧКОМ без подписи, а подпись — подсказкой при наведении. Место в шапке узкое
 * (34 пикселя высоты и остаток строки после заголовка), и слово «Обновить» рядом с ним
 * отняло бы у заголовка треть ширины ради текста, который читают один раз. Доступное имя
 * при этом остаётся: `aria-label` несёт ту же строку, что и подсказка, поэтому кнопка
 * называется и для скринридера, и для проверки в тестах.
 *
 * @module plugins/templates/ui/TemplatesActions
 */

import type { ReactNode } from 'react';
import { Button } from '@reformer/ui-kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@reformer/ui-kit/tooltip';
import { RotateCcw } from 'lucide-react';
import type { TemplatesHost } from '../host';
import type { TemplatesRefresh } from '../content/refresh';

export interface TemplatesActionsProps {
  readonly host: TemplatesHost;
  readonly refresh: TemplatesRefresh;
}

export function TemplatesActions({ host, refresh }: TemplatesActionsProps): ReactNode {
  const t = host.useTranslate();
  const title = t('action.refresh');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={title}
          data-testid="button-refresh"
          className="size-6"
          onClick={() => refresh.request()}
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
