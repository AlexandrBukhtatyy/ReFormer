/**
 * Быстрое добавление компонента (Enter): командная палитра — поле поиска + список каталога.
 * Печатаешь название → фильтр по подстроке; ↑/↓ — навигация, Enter — вставить, Esc — закрыть,
 * клик — вставить. Узел вставляется умно по контексту выделения (`editorActions.addComponent`).
 *
 * @module reformer-builder/canvas/QuickAddDialog
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { getCatalog, type CatalogEntry } from '../catalog';
import { editorActions, useUi } from '../store';
import { cn } from '../lib/cn';

/** Подпись: у html-элементов — имя тега (без обёртки `$html(...)`). */
function label(entry: CatalogEntry): string {
  const n = entry.name;
  return n.startsWith('$html(') && n.endsWith(')') ? n.slice(6, -1) : n;
}

export function QuickAddDialog() {
  const open = useUi().quickAddOpen;
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const catalog = getCatalog();

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (e) => label(e).toLowerCase().includes(needle) || e.name.toLowerCase().includes(needle)
    );
  }, [catalog, q]);

  // Сброс поля/выделения при открытии — подстройка состояния во время рендера,
  // а не в эффекте (react-hooks/set-state-in-effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ('');
      setActive(0);
    }
  }

  // Не выходить за границы при фильтрации — клампим во время рендера.
  if (active > items.length - 1) {
    setActive(Math.max(0, items.length - 1));
  }

  // Фокус на поле при открытии — DOM-side-effect, остаётся в эффекте.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Проскроллить активный элемент в зону видимости.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const insert = (entry: CatalogEntry | undefined) => {
    if (!entry) return;
    editorActions.addComponent(entry.makeNode());
    editorActions.closeQuickAdd();
  };

  // Навигация внутри модалки; stopPropagation — чтобы глобальный keydown canvas не вмешивался.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      insert(items[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      editorActions.closeQuickAdd();
    }
  };

  return (
    <div
      onClick={() => editorActions.closeQuickAdd()}
      className="fixed inset-0 z-50 grid justify-center bg-black/50 p-4 pt-[12vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[64vh] w-[440px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Добавить компонент…"
          className="flex-none border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div ref={listRef} className="min-h-0 flex-1 overflow-auto p-1">
          {items.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Ничего не найдено
            </div>
          )}
          {items.map((entry, i) => (
            <button
              key={entry.name}
              type="button"
              data-active={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => insert(entry)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]',
                i === active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'
              )}
            >
              <span className="min-w-0 flex-1 truncate">{label(entry)}</span>
              {entry.category && (
                <span className="flex-none text-[10px] text-muted-foreground">
                  {entry.category}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-none border-t border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">
          ↑↓ выбрать · Enter вставить · Esc закрыть
        </div>
      </div>
    </div>
  );
}
