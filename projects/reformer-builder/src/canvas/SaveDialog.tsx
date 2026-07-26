/**
 * Diff-модалка сохранения (спека §7.3): два столбца «текущий файл / после сохранения» с
 * построчной подсветкой, счётчик `+N −M`, предупреждение о конфликте (внешние правки),
 * кнопки Сохранить/Отмена. Закрытие по фону/Esc — в EditorLayout.
 *
 * @module reformer-builder/canvas/SaveDialog
 */

import { Button } from '@reformer/ui-kit';
import type { DiffOp } from '../io/diff';
import { saveDialogActions, useSaveDialog } from '../store/save-dialog';
import { confirmSave } from '../app/save-actions';
import { cn } from '../lib/cn';

function DiffColumn({ title, ops, side }: { title: string; ops: DiffOp[]; side: 'old' | 'new' }) {
  const visible = ops.filter((o) => (side === 'old' ? o.type !== 'add' : o.type !== 'del'));
  let lineNo = 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex-none border-b border-border bg-sidebar px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex-1 overflow-auto py-2 font-mono text-[10.5px] leading-relaxed">
        {visible.map((o, i) => {
          lineNo += 1;
          const marker = o.type === 'del' ? '−' : o.type === 'add' ? '+' : ' ';
          return (
            <div
              key={i}
              className={cn(
                'flex whitespace-pre',
                o.type === 'del' && 'bg-red-500/15',
                o.type === 'add' && 'bg-green-500/15'
              )}
            >
              <span className="w-9 flex-none select-none pr-2 text-right text-muted-foreground/40">
                {lineNo}
              </span>
              <span
                className={cn(
                  'w-3 flex-none select-none text-center',
                  o.type === 'del' && 'text-red-600',
                  o.type === 'add' && 'text-green-600',
                  o.type === 'same' && 'text-transparent'
                )}
              >
                {marker}
              </span>
              <span className="min-w-0 flex-1 pr-3">{o.text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SaveDialog() {
  const { plan, saving } = useSaveDialog();
  if (!plan) return null;

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
          <DiffColumn title="Текущий файл" ops={plan.diff} side="old" />
          <div className="w-px flex-none bg-border" />
          <DiffColumn title="После сохранения" ops={plan.diff} side="new" />
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
