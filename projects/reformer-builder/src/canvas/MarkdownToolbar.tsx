/**
 * Полоса режимов markdown-вкладки: Код / Предпросмотр / Рядом (в стиле VSCode). Сегмент собран
 * вручную из кнопок — тем же приёмом, что переключатель вида схемы в {@link FloatingActions}.
 *
 * @module reformer-builder/canvas/MarkdownToolbar
 */

import { Code2, Columns2, Eye } from 'lucide-react';
import type { MarkdownView, TabState } from '../store';
import { applyMarkdownView } from './markdown/view-pref';
import { cn } from '../lib/cn';
import { formatShortcut } from '../lib/shortcuts';

const CYCLE = formatShortcut('Mod+Shift+V');

const SEGMENTS: ReadonlyArray<{
  view: MarkdownView;
  label: string;
  hint: string;
  Icon: typeof Code2;
}> = [
  { view: 'code', label: 'Код', hint: `Исходник в редакторе (цикл ${CYCLE})`, Icon: Code2 },
  { view: 'preview', label: 'Предпросмотр', hint: `Рендер файла (цикл ${CYCLE})`, Icon: Eye },
  {
    view: 'split',
    label: 'Рядом',
    hint: `Редактор и рендер с синхроскроллом (${formatShortcut('Mod+K')} ${formatShortcut('V')})`,
    Icon: Columns2,
  },
];

export function MarkdownToolbar({ tab }: { tab: TabState }) {
  const active = tab.mdView ?? 'code';
  return (
    <div className="flex h-[30px] flex-none items-center justify-end gap-1.5 border-b border-border bg-sidebar px-1.5">
      <div className="flex flex-none gap-0.5 rounded-md border border-border bg-muted p-0.5">
        {SEGMENTS.map(({ view, label, hint, Icon }) => (
          <button
            key={view}
            onClick={() => applyMarkdownView(tab.id, view)}
            title={hint}
            aria-pressed={active === view}
            className={cn(
              'flex h-5 items-center gap-1 rounded px-2 text-[11.5px]',
              active === view ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
