/**
 * Предпросмотр набора изменений: что именно сделает ассистент, до того как это попадёт в форму.
 *
 * Предпросмотр — не украшение, а следствие модели работы: ход правит черновик, поэтому у
 * пользователя есть точка решения. Она же снимает необходимость в транзакциях: применение —
 * один `replaceSchema`, отменяемый одним Ctrl+Z.
 *
 * @module reformer-builder/panels/agent/ChangePreview
 */

import { Check, TriangleAlert, X } from 'lucide-react';
import { Button, ScrollArea } from '@reformer/ui-kit';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import type { ChangeOp } from '../../agent/core/types';
import type { ChangeSet } from '../../agent/core/changeset';
import { cn } from '../../lib/cn';

/** Знак и цвет операции по её виду. */
const OP_STYLE: Record<ChangeOp['kind'], { mark: string; className: string }> = {
  add: { mark: '+', className: 'text-emerald-600 dark:text-emerald-400' },
  update: { mark: '~', className: 'text-amber-600 dark:text-amber-400' },
  remove: { mark: '−', className: 'text-rose-600 dark:text-rose-400' },
  move: { mark: '→', className: 'text-sky-600 dark:text-sky-400' },
};

/** Свойства предпросмотра. */
export interface ChangePreviewProps {
  set: ChangeSet;
  /** Активная вкладка разошлась с базой хода. */
  conflict: boolean;
  onApply: () => void;
  onForceApply: () => void;
  onReject: () => void;
}

/** Список изменений с кнопками решения. */
export function ChangePreview({
  set,
  conflict,
  onApply,
  onForceApply,
  onReject,
}: ChangePreviewProps) {
  return (
    // Колонка с потолком высоты, а не блок по содержимому: длинный ход даёт десятки операций, и
    // список, растущий свободно, выдавливал кнопки за край панели — решение по набору изменений
    // становилось недоступным ровно тогда, когда работы было больше всего. Потолок в половину
    // панели оставляет видимой и переписку.
    <div className="flex max-h-[50%] min-h-0 flex-none flex-col border-t border-border bg-muted/40 px-3 py-2.5">
      <div className="mb-1.5 flex-none text-[11.5px] font-semibold text-muted-foreground">
        Изменений: {set.ops.length}
      </div>

      {/* min-h-0 обязателен: без него flex-элемент не сжимается ниже своего содержимого, и
          прокрутка не включается — список снова растёт наружу. */}
      <ScrollArea className="mb-2 min-h-0 flex-1">
        <ul className="space-y-0.5">
          {set.ops.map((op, i) => (
            <li key={`${op.ref}-${i}`} className="flex gap-1.5 text-[12px] leading-5">
              <span className={cn('flex-none font-mono', OP_STYLE[op.kind].className)}>
                {OP_STYLE[op.kind].mark}
              </span>
              <span className="min-w-0 break-words">{op.summary}</span>
            </li>
          ))}
        </ul>
      </ScrollArea>

      {conflict && (
        <Alert className="mb-2 flex-none border-amber-500/40 bg-amber-500/10 py-2">
          <TriangleAlert className="text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-[11.5px] leading-4">
            Форму изменили, пока ассистент работал. Применение перезапишет эти правки.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-none gap-2">
        <Button size="sm" className="flex-1" onClick={conflict ? onForceApply : onApply}>
          <Check />
          {conflict ? 'Применить всё равно' : 'Применить'}
        </Button>
        <Button variant="outline" size="sm" onClick={onReject}>
          <X />
          Отклонить
        </Button>
      </div>
    </div>
  );
}
