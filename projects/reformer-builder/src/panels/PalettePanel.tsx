/**
 * Палитра компонентов (спека §8): каталог, сгруппированный по категориям, с поиском.
 * В этом слайсе — клик добавляет узел в ближайший контейнер выделения (или в корень);
 * полноценный drag-drop — в следующем слайсе.
 *
 * @module reformer-builder/panels/PalettePanel
 */

import { useMemo, useState } from 'react';
import { Input, ScrollArea } from '@reformer/ui-kit';
import { isContainerNode, type JsonFormSchema } from '@reformer/renderer-json';
import { appendNode, findByPath, parentNodePath, type JsonPath } from '../model';
import { getCatalog, type CatalogEntry } from '../catalog';
import { editorActions, editorStore } from '../store';
import { clearDrag, setDrag } from '../dnd/drag-state';

const CATEGORY_ORDER = [
  'Поля ввода',
  'Выбор и переключатели',
  'Контейнеры',
  'Действия',
  'Отображение',
  'Массив',
  'HTML',
  'Оверлеи',
  'Навигация',
  'Чат',
  'Прочее',
];

/** Тег из синтетического HTML-имени: `$html(div)` → `div`; для остальных — `null`. */
function htmlTag(name: string): string | null {
  return name.startsWith('$html(') ? name.slice('$html('.length, -1) : null;
}

/** Текстовый глиф-бейдж элемента палитры (аббревиатура типа, как в дизайн-макете). */
const HTML_GLYPH: Record<string, string> = { div: 'div', section: 'sec', fieldset: 'fs', h3: 'h3', p: 'p', hr: 'hr' };
const GLYPH_BY_NAME: Record<string, string> = {
  Input: 'In', InputPassword: 'Ip', InputMask: 'Im', InputOTP: 'Io',
  Textarea: 'Tx', DatePicker: 'Dt', Calendar: 'Ca', FileUpload: 'Up', FileUploadAvatar: 'Av',
  Select: 'Se', NativeSelect: 'Ns', Combobox: 'Cb', RadioGroup: 'Rg', Checkbox: 'Ck',
  Switch: 'Sw', Slider: 'Sl', Toggle: 'Tg', ToggleGroup: 'Tg',
  Box: 'Bx', Section: 'Sc', FormArray: 'Fa',
};

function glyph(entry: CatalogEntry): string {
  const tag = htmlTag(entry.name);
  if (tag) return HTML_GLYPH[tag] ?? tag.slice(0, 3);
  return GLYPH_BY_NAME[entry.name] ?? (entry.name[0]?.toUpperCase() ?? '') + (entry.name[1]?.toLowerCase() ?? '');
}

/** Отображаемая подпись: у HTML-элементов — просто имя тега (без обёртки `$html(...)`). */
function displayName(entry: CatalogEntry): string {
  return htmlTag(entry.name) ?? entry.name;
}

function groupByCategory(catalog: CatalogEntry[], q: string): Array<[string, CatalogEntry[]]> {
  const needle = q.trim().toLowerCase();
  const filtered = needle ? catalog.filter((e) => e.name.toLowerCase().includes(needle)) : catalog;
  const map = new Map<string, CatalogEntry[]>();
  for (const e of filtered) {
    const c = e.category ?? 'Прочее';
    const list = map.get(c) ?? [];
    list.push(e);
    map.set(c, list);
  }
  const known = CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as [string, CatalogEntry[]]);
  const rest = [...map.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).map((c) => [c, map.get(c)!] as [string, CatalogEntry[]]);
  return [...known, ...rest];
}

/** Ближайший контейнер-слот от выделения (или корень) — куда добавить новый узел. */
function resolveSlot(schema: JsonFormSchema, selPath: JsonPath | null): JsonPath | null {
  let path: JsonPath | null = selPath;
  while (path && path.length) {
    const node = findByPath(schema, path);
    if (node && isContainerNode(node)) return [...path, 'children'];
    path = parentNodePath(path);
  }
  return isContainerNode(schema.root) ? ['root', 'children'] : null;
}

export function PalettePanel() {
  const [q, setQ] = useState('');
  const catalog = getCatalog();
  const groups = useMemo(() => groupByCategory(catalog, q), [catalog, q]);
  // Форс-категории раскрыты; вспомогательные (HTML/оверлеи/навигация/чат) свёрнуты по умолчанию
  // (спека §8, дизайн-макет). Поиск временно раскрывает все разделы.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    HTML: true,
    Оверлеи: true,
    Навигация: true,
    Чат: true,
  });
  const toggle = (cat: string) => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }));
  const isOpen = (cat: string) => (q.trim() ? true : !collapsed[cat]);

  const pick = (entry: CatalogEntry) => {
    const st = editorStore.getState();
    const tab = st.activeTabId ? st.tabs[st.activeTabId] : null;
    if (!tab) return;
    const slot = resolveSlot(tab.schema, tab.selectionPath) ?? ['root', 'children'];
    editorActions.apply((schema) => appendNode(schema, slot, entry.makeNode()));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск компонента…"
          className="h-8 text-xs"
        />
      </div>
      <ScrollArea className="flex-1">
        {groups.map(([cat, items]) => {
          const open = isOpen(cat);
          return (
            <div key={cat} className="border-b border-border">
              <button
                type="button"
                onClick={() => toggle(cat)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span className={`text-[8px] leading-none transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                <span className="min-w-0 flex-1 truncate">{cat}</span>
                <span className="flex-none font-mono text-[10px] font-normal text-muted-foreground/50">{items.length}</span>
              </button>
              {open && (
                <div className="flex flex-col gap-0.5 px-2 pb-2">
                  {items.map((e) => (
                    <button
                      key={e.name}
                      draggable
                      onDragStart={(ev) => {
                        setDrag({ kind: 'new', entryName: e.name });
                        ev.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDragEnd={() => clearDrag()}
                      onClick={() => pick(e)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-muted"
                    >
                      <span className="grid h-5 min-w-5 flex-none place-items-center rounded border border-border bg-background px-1 font-mono text-[9px] font-semibold text-muted-foreground">
                        {glyph(e)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{displayName(e)}</span>
                      <span className="flex-none text-xs text-muted-foreground/40">⋮⋮</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}
