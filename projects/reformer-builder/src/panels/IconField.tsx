/**
 * Пикер иконок lucide в инспекторе (виджет `icon`, ключ пропа `iconName`). Триггер показывает
 * текущую иконку + имя; по клику — поповер с поиском и сеткой иконок. Выбор пишет имя (PascalCase)
 * через `setComponentProp` с коалесингом. Набор фильтруется по подстроке, выводится до `LIMIT`.
 *
 * @module reformer-builder/panels/IconField
 */

import { useMemo, useState, type ComponentType } from 'react';
import { icons, type LucideProps } from 'lucide-react';
import type { JsonNode } from '@reformer/renderer-json';
import { setComponentProp, type JsonPath } from '../model';
import { editorActions } from '../store';
import type { InspectorProp } from '../catalog';
import { cn } from '../lib/cn';

const REGISTRY = icons as unknown as Record<string, ComponentType<LucideProps>>;
const ALL_NAMES = Object.keys(REGISTRY);
const LIMIT = 60;

export function IconField({
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
  const current = typeof raw === 'string' ? raw : '';

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? ALL_NAMES.filter((n) => n.toLowerCase().includes(needle)) : ALL_NAMES;
    return base.slice(0, LIMIT);
  }, [q]);

  const set = (name: string) =>
    editorActions.apply((s) => setComponentProp(s, path, prop.key, name), {
      coalesceKey: `${prop.key}@${path.join('.')}`,
    });

  const Current = current ? REGISTRY[current] : undefined;

  return (
    <div className="flex min-h-6 items-start gap-2.5">
      <span className="w-24 flex-none truncate pt-1 text-xs" title={prop.description}>
        {prop.label}
      </span>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-[26px] w-full items-center gap-2 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring"
        >
          {Current ? (
            <Current size={14} className="flex-none" />
          ) : (
            <span className="flex-none text-muted-foreground">—</span>
          )}
          <span className="min-w-0 flex-1 truncate text-left">{current || 'Выбрать иконку'}</span>
        </button>
        {open && (
          <div className="absolute inset-x-0 top-[30px] z-50 rounded-md border border-border bg-background p-2 shadow-md">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
              placeholder="Поиск иконки…"
              className="mb-2 h-[26px] w-full rounded border border-input bg-background px-2 text-xs outline-none focus:border-ring"
            />
            <div className="grid max-h-[220px] grid-cols-6 gap-1 overflow-auto">
              {list.map((name) => {
                const Ic = REGISTRY[name];
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      set(name);
                      setOpen(false);
                    }}
                    className={cn(
                      'grid aspect-square place-items-center rounded hover:bg-muted',
                      name === current && 'bg-primary/10 text-primary'
                    )}
                  >
                    <Ic size={16} />
                  </button>
                );
              })}
              {list.length === 0 && (
                <div className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                  Ничего не найдено
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
