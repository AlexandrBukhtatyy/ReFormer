/**
 * Предпросмотр набора изменений: что именно сделает ассистент, до того как это попадёт в форму.
 *
 * Предпросмотр — не украшение, а следствие модели работы. Обычный ход применяется сам, и
 * решать по нему нечего: отменяет его «Восстановить» на реплике. Панель остаётся ровно для
 * случая, когда применить не удалось, — форму правили руками, пока ассистент работал. Молча
 * перезаписать чужую правку нельзя, а работу хода жалко, поэтому здесь развилка с кнопками.
 *
 * Собрано на `@reformer/ui-kit`: список — `ScrollArea` + `Item`, предупреждение — `Alert`,
 * решения — `Button`. Знак операции несёт `Badge`, а не крашеный `span`: у кита для пометки
 * есть свой компонент, и он же приносит тему.
 *
 * @module plugins/ai/ui/ChangePreview
 */

import type { ReactElement } from 'react';
import { Check, TriangleAlert, X } from 'lucide-react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { ChangeOp } from '../model/types';
import type { Translate } from '../host';
import type { PendingChanges } from '../session/session';

/** Знак и цвет операции по её виду. */
const OP_STYLE: Record<ChangeOp['kind'], { readonly mark: string; readonly className: string }> = {
  add: { mark: '+', className: 'text-emerald-600 dark:text-emerald-400' },
  update: { mark: '~', className: 'text-amber-600 dark:text-amber-400' },
  remove: { mark: '−', className: 'text-rose-600 dark:text-rose-400' },
  move: { mark: '→', className: 'text-sky-600 dark:text-sky-400' },
};

export interface ChangePreviewProps {
  readonly pending: PendingChanges;
  /** Буфер разошёлся с базой хода. */
  readonly conflict: boolean;
  readonly t: Translate;
  readonly onApply: () => void;
  readonly onForceApply: () => void;
  readonly onReject: () => void;
}

/** Список изменений с кнопками решения. */
export function ChangePreview({
  pending,
  conflict,
  t,
  onApply,
  onForceApply,
  onReject,
}: ChangePreviewProps): ReactElement {
  const ops = pending.set.ops;
  return (
    // Колонка с потолком высоты, а не блок по содержимому: длинный ход даёт десятки операций,
    // и список, растущий свободно, выдавливал кнопки за край панели — решение по набору
    // становилось недоступным ровно тогда, когда работы было больше всего.
    <div className="border-border bg-muted/40 flex max-h-[50%] min-h-0 flex-none flex-col border-t px-3 py-2.5">
      <div className="text-muted-foreground mb-1.5 flex-none text-[11.5px] font-semibold">
        {t('changes.count', { count: ops.length })}
      </div>

      {/* min-h-0 обязателен: без него flex-элемент не сжимается ниже своего содержимого,
          и прокрутка не включается — список снова растёт наружу. */}
      <ScrollArea className="mb-2 min-h-0 flex-1">
        <ul className="space-y-0.5">
          {ops.map((op, index) => (
            <li key={`${op.ref}-${String(index)}`} className="flex gap-1.5 text-[12px] leading-5">
              <Badge
                variant="outline"
                className={`h-4 flex-none px-1 font-mono text-[10px] ${OP_STYLE[op.kind].className}`}
              >
                {OP_STYLE[op.kind].mark}
              </Badge>
              <span className="min-w-0 break-words">{op.summary}</span>
            </li>
          ))}
        </ul>
      </ScrollArea>

      {conflict && (
        <Alert className="mb-2 flex-none py-2">
          <TriangleAlert className="text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-[11.5px] leading-4">
            {t('changes.conflict')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-none gap-2">
        <Button size="sm" className="flex-1" onClick={conflict ? onForceApply : onApply}>
          <Check />
          {conflict ? t('changes.applyAnyway') : t('changes.apply')}
        </Button>
        <Button variant="outline" size="sm" onClick={onReject}>
          <X />
          {t('changes.reject')}
        </Button>
      </div>
    </div>
  );
}
