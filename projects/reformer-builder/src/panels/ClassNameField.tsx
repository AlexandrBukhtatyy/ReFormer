/**
 * Редактор `className` в инспекторе: полноширинный input + выпадающие подсказки Tailwind-классов
 * по токену под кареткой. Значение — обычная строка (список классов через пробел), любой кастомный
 * класс допустим (свободный ввод). Подсказки фильтруются по текущему токену, уже использованные
 * классы из списка исключаются. Навигация: ↑/↓ — выбор, Enter/Tab — вставить, Esc — закрыть, клик —
 * вставить. Запись идёт через `setComponentProp` с коалесингом (как остальные пропы инспектора).
 *
 * @module reformer-builder/panels/ClassNameField
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import type { JsonNode } from '@reformer/renderer-json';
import { setComponentProp, type JsonPath } from '../model';
import { editorActions } from '../store';
import type { InspectorProp } from '../catalog';
import { TAILWIND_CLASSES } from '../lib/tailwind-classes';
import { cn } from '../lib/cn';

const MAX_SUGGESTIONS = 24;

export function ClassNameField({
  node,
  path,
  prop,
}: {
  node: JsonNode;
  path: JsonPath;
  prop: InspectorProp;
}) {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  const raw = props[prop.key];
  const value = typeof raw === 'string' ? raw : '';

  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);

  // Пустое значение убирает проп из схемы (как раньше для readonly-поля).
  const set = (v: string) =>
    editorActions.apply((s) => setComponentProp(s, path, prop.key, v.trim() ? v : undefined), {
      coalesceKey: `${prop.key}@${path.join('.')}`,
    });

  // Токен под кареткой (между окружающими пробелами) — по нему фильтруем подсказки.
  const pos = Math.min(caret, value.length);
  const tokenStart = value.slice(0, pos).search(/\S*$/);
  const tokenEnd = pos + (value.slice(pos).match(/^\S*/)?.[0].length ?? 0);
  const token = value.slice(tokenStart, pos);

  const used = new Set(value.split(/\s+/).filter(Boolean));
  const needle = token.toLowerCase();
  const suggestions = needle
    ? TAILWIND_CLASSES.filter(
        (c) => c.toLowerCase().includes(needle) && (c === token || !used.has(c))
      ).slice(0, MAX_SUGGESTIONS)
    : [];
  const showList = open && suggestions.length > 0;
  const activeIdx = suggestions.length ? Math.min(active, suggestions.length - 1) : 0;

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? value.length);

  // Заменить токен под кареткой выбранным классом + пробел, вернуть каретку за него.
  const complete = (cls: string) => {
    const head = value.slice(0, tokenStart);
    const tail = value.slice(tokenEnd);
    const insert = cls + (tail.startsWith(' ') ? '' : ' ');
    const next = head + insert + tail;
    const nextPos = head.length + insert.length;
    set(next);
    setCaret(nextPos);
    setActive(0);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && showList) {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.max(a - 1, 0));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && showList) {
      e.preventDefault();
      e.stopPropagation();
      complete(suggestions[activeIdx]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="flex min-h-6 items-center gap-2.5">
      <span className="w-24 flex-none truncate text-xs" title={prop.description}>
        {prop.label}
      </span>
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          value={value}
          spellCheck={false}
          autoComplete="off"
          placeholder="flex gap-4 …"
          onChange={(e) => {
            set(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onSelect={syncCaret}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="h-[26px] w-full rounded-md border border-input bg-background px-2 font-mono text-[11px] outline-none focus:border-ring"
        />
        {showList && (
          <div className="absolute inset-x-0 top-[30px] z-50 max-h-[240px] overflow-auto rounded-md border border-border bg-background p-1 shadow-md">
            {suggestions.map((cls, i) => (
              <button
                key={cls}
                type="button"
                // mousedown-preventDefault: не терять фокус input до onClick.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => complete(cls)}
                className={cn(
                  'block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px]',
                  i === activeIdx ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'
                )}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
