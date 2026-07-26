/**
 * Diff-модалка сохранения (спека §7.3): два столбца «текущий файл / после сохранения» с
 * построчной подсветкой, счётчик `+N −M`, предупреждение о конфликте (внешние правки),
 * навигация по группам изменений (стрелки в шапке скроллят обе колонки синхронно),
 * кнопки Сохранить/Отмена. Закрытие по фону/Esc — в EditorLayout.
 *
 * @module reformer-builder/canvas/SaveDialog
 */

import { Button } from '@reformer/ui-kit';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { DiffOp } from '../io/diff';
import { saveDialogActions, useSaveDialog } from '../store/save-dialog';
import { confirmSave } from '../app/save-actions';
import { cn } from '../lib/cn';

function DiffColumn({
  title,
  ops,
  side,
  scrollRef,
}: {
  title: string;
  ops: DiffOp[];
  side: 'old' | 'new';
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const visible = ops
    .map((op, idx) => ({ op, idx }))
    .filter(({ op }) => (side === 'old' ? op.type !== 'add' : op.type !== 'del'));
  let lineNo = 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex-none border-b border-border bg-sidebar px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto py-2 font-mono text-[10.5px] leading-relaxed"
      >
        {visible.map(({ op, idx }) => {
          lineNo += 1;
          const marker = op.type === 'del' ? '−' : op.type === 'add' ? '+' : ' ';
          return (
            <div
              key={idx}
              data-op-index={idx}
              className={cn(
                'flex whitespace-pre',
                op.type === 'del' && 'bg-red-500/15',
                op.type === 'add' && 'bg-green-500/15'
              )}
            >
              <span className="w-9 flex-none select-none pr-2 text-right text-muted-foreground/40">
                {lineNo}
              </span>
              <span
                className={cn(
                  'w-3 flex-none select-none text-center',
                  op.type === 'del' && 'text-red-600',
                  op.type === 'add' && 'text-green-600',
                  op.type === 'same' && 'text-transparent'
                )}
              >
                {marker}
              </span>
              <span className="min-w-0 flex-1 pr-3">{op.text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Стартовые индексы (в `plan.diff`) групп соседних изменённых строк — цели навигации. */
function changeGroups(ops: DiffOp[]): number[] {
  const starts: number[] = [];
  let inGroup = false;
  ops.forEach((op, i) => {
    if (op.type !== 'same') {
      if (!inGroup) starts.push(i);
      inGroup = true;
    } else {
      inGroup = false;
    }
  });
  return starts;
}

/** Скроллит колонку так, чтобы первая видимая строка с op-индексом ≥ `opIndex` оказалась по центру. */
function scrollColumnTo(container: HTMLDivElement | null, opIndex: number) {
  if (!container) return;
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-op-index]'));
  const target =
    rows.find((r) => Number(r.dataset.opIndex) >= opIndex) ?? rows[rows.length - 1];
  if (!target) return;
  const top = target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2;
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

export function SaveDialog() {
  const { plan, saving } = useSaveDialog();
  const oldRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);

  const groups = useMemo(() => (plan ? changeGroups(plan.diff) : []), [plan]);

  if (!plan) return null;

  const goTo = (idx: number) => {
    if (groups.length === 0) return;
    const clamped = Math.max(0, Math.min(groups.length - 1, idx));
    setActive(clamped);
    scrollColumnTo(oldRef.current, groups[clamped]);
    scrollColumnTo(newRef.current, groups[clamped]);
  };

  return (
    <div
      onClick={saveDialogActions.close}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[72vh] w-[880px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <div className="flex flex-none items-center gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Сохранить изменения?</div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{plan.tabId}</div>
          </div>
          <span className="flex-1" />
          {groups.length > 0 && (
            <div className="flex flex-none items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                aria-label="Предыдущее изменение"
                title="Предыдущее изменение"
                disabled={active <= 0}
                onClick={() => goTo(active - 1)}
              >
                <ChevronUp />
              </Button>
              <span className="w-9 select-none text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                {active < 0 ? '–' : active + 1}/{groups.length}
              </span>
              <Button
                variant="outline"
                size="icon-xs"
                aria-label="Следующее изменение"
                title="Следующее изменение"
                disabled={active >= groups.length - 1}
                onClick={() => goTo(active + 1)}
              >
                <ChevronDown />
              </Button>
            </div>
          )}
          <span className="flex-none rounded-full border border-border bg-muted px-2.5 py-1 font-mono text-[11.5px]">
            +{plan.added} −{plan.removed}
          </span>
        </div>

        {plan.conflict && (
          <div className="flex-none border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            ⚠ Файл изменился на диске после открытия. Сохранение перезапишет внешние правки.
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <DiffColumn title="Текущий файл" ops={plan.diff} side="old" scrollRef={oldRef} />
          <div className="w-px flex-none bg-border" />
          <DiffColumn title="После сохранения" ops={plan.diff} side="new" scrollRef={newRef} />
        </div>

        <div className="flex flex-none justify-end gap-2 border-t border-border p-3">
          <Button variant="outline" size="sm" onClick={saveDialogActions.close}>
            Отмена
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void confirmSave(plan)}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
