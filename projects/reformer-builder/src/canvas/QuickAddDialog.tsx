/**
 * Быстрое добавление компонента (Enter): широкая модалка-каталог в несколько колонок, разделы —
 * категории палитры. Печатаешь название → фильтр по подстроке; ↑/↓ — по колонке, ←/→ — между
 * колонками, Enter — вставить, Esc — закрыть, клик — вставить. Узел вставляется умно по контексту
 * выделения (`editorActions.addComponent`).
 *
 * Без поиска показываются дефолт-варианты групп, части compound'ов — с отступом под своим корнем;
 * поиск ищет по всему каталогу.
 *
 * @module reformer-builder/canvas/QuickAddDialog
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  displayName,
  getCatalog,
  groupByCategory,
  isCompoundPart,
  partsOf,
  type CatalogEntry,
} from '../catalog';
import { collapseToDefaults, isDefaultVariant } from '../catalog/variants';
import { editorActions, useUi } from '../store';
import { cn } from '../lib/cn';

/** Минимальная ширина колонки, px — по ней считается, сколько колонок влезло. */
const MIN_COLUMN_WIDTH = 210;
/** Зазор между колонками, px (должен совпадать с `gap-5` в разметке). */
const COLUMN_GAP = 20;
/** Во сколько строк обходится заголовок раздела (сам заголовок + отступ под разделом). */
const HEADER_ROWS = 2;
/** Меньше этого числа записей в хвосте колонки раздел не начинаем — уводим целиком ниже. */
const MIN_CHUNK_ROWS = 3;
/** Ниже этого числа строк колонку не заводим — иначе выдача из трёх записей разъезжается по всей ширине. */
const MIN_ROWS_PER_COLUMN = 8;

/** Запись с её сквозным индексом в плоском порядке обхода (для ↑/↓/Enter). */
interface Item {
  entry: CatalogEntry;
  index: number;
}

/** Раздел каталога — категория палитры со своими записями. */
interface Section {
  category: string;
  items: Item[];
}

/** Кусок раздела, попавший в одну колонку: раздел длиннее колонки продолжается в следующей. */
interface Chunk {
  key: string;
  category: string;
  /** Всего записей в разделе — показывается счётчиком у первого куска. */
  total: number;
  /** Кусок — продолжение раздела из предыдущей колонки. */
  continued: boolean;
  items: Item[];
}

/**
 * Обзорный режим (пустой поиск): один дефолт-вариант на группу, части compound'ов — следом за своим
 * корнем (`Alert` → `AlertTitle`, `AlertDescription`) и с отступом при отрисовке. Из общего порядка
 * каталога части сами по себе не читаются как принадлежащие корню, поэтому переставляем.
 */
function overview(catalog: CatalogEntry[]): CatalogEntry[] {
  const roots = collapseToDefaults(catalog.filter((e) => !isCompoundPart(e)));
  return roots.flatMap((root) => [root, ...collapseToDefaults(partsOf(root.name))]);
}

/** Отфильтровать каталог по строке поиска (пустая — обзорный режим). */
function filterCatalog(catalog: CatalogEntry[], q: string): CatalogEntry[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return overview(catalog);
  return catalog.filter(
    (e) => displayName(e).toLowerCase().includes(needle) || e.name.toLowerCase().includes(needle)
  );
}

/** Разделы + плоский список в том же порядке: индекс записи = позиция в плоском списке. */
function buildSections(entries: CatalogEntry[]): { sections: Section[]; flat: CatalogEntry[] } {
  const flat: CatalogEntry[] = [];
  const sections = groupByCategory(entries).map(([category, list]) => ({
    category,
    items: list.map((entry) => ({ entry, index: flat.push(entry) - 1 })),
  }));
  return { sections, flat };
}

/**
 * Разложить разделы по колонкам вручную, а не отдать `columns` браузеру: CSS-раскладка либо рвёт
 * раздел без заголовка, либо (с `break-inside: avoid`) оставляет в колонке дыру во всю высоту
 * следующего раздела. Здесь высота колонок выравнивается по среднему, а раздел, не влезший в
 * остаток, продолжается в следующей колонке со своим заголовком.
 */
function layoutColumns(sections: Section[], maxColumns: number): Chunk[][] {
  const total = sections.reduce((sum, s) => sum + s.items.length + HEADER_ROWS, 0);
  const count = Math.max(1, Math.min(maxColumns, Math.ceil(total / MIN_ROWS_PER_COLUMN)));
  const target = Math.ceil(total / count);
  const columns: Chunk[][] = Array.from({ length: count }, () => []);
  let column = 0;
  let used = 0;
  for (const section of sections) {
    let rest = section.items;
    let continued = false;
    while (rest.length) {
      const last = column === count - 1;
      const free = target - used - HEADER_ROWS;
      // В хвосте колонки поместилось бы полтора пункта — начинать раздел здесь незачем.
      if (!last && free < MIN_CHUNK_ROWS) {
        column += 1;
        used = 0;
        continue;
      }
      const take = last ? rest.length : Math.min(rest.length, free);
      columns[column].push({
        key: `${section.category}#${column}`,
        category: section.category,
        total: section.items.length,
        continued,
        items: rest.slice(0, take),
      });
      used += take + HEADER_ROWS;
      rest = rest.slice(take);
      continued = true;
      if (rest.length) {
        column += 1;
        used = 0;
      }
    }
  }
  return columns;
}

/** Сколько колонок влезает по ширине элемента (пересчитывается на ресайз окна/панели). */
function useColumnCount(ref: React.RefObject<HTMLElement | null>, enabled: boolean): number {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const measure = (width: number) =>
      setCount(Math.max(1, Math.floor((width + COLUMN_GAP) / (MIN_COLUMN_WIDTH + COLUMN_GAP))));
    measure(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return count;
}

export function QuickAddDialog() {
  const open = useUi().quickAddOpen;
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const catalog = getCatalog();
  const columnCount = useColumnCount(listRef, open);

  const { sections, flat } = useMemo(() => buildSections(filterCatalog(catalog, q)), [catalog, q]);
  const columns = useMemo(() => layoutColumns(sections, columnCount), [sections, columnCount]);

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
  // Сравнивать надо с уже заклампленным индексом: при пустом списке (ввод, по которому нет
  // совпадений — напр. кириллица) flat.length - 1 = -1, а setActive выставляет 0. Если сравнивать
  // с -1, условие active > -1 остаётся истинным и после клампа → setActive в фазе рендера зовётся
  // каждый проход → «Too many re-renders».
  const maxActive = Math.max(0, flat.length - 1);
  if (active > maxActive) {
    setActive(maxActive);
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

  /**
   * Переход в соседнюю колонку: разделы разной длины, поэтому «соседа» ищем по геометрии —
   * ближайший по X в нужную сторону, среди них ближайший по Y.
   */
  const moveAcross = (dir: -1 | 1) => {
    const root = listRef.current;
    const nodes = root ? [...root.querySelectorAll<HTMLElement>('[data-idx]')] : [];
    const cur = nodes[active];
    if (!cur) return;
    const from = cur.getBoundingClientRect();
    let best: { index: number; dx: number; dy: number } | null = null;
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      const dx = (box.left - from.left) * dir;
      if (dx < 8) continue; // та же колонка или не в ту сторону
      const dy = Math.abs(box.top - from.top);
      const sameColumn = best && Math.abs(dx - best.dx) < 8;
      if (!best || dx < best.dx - 8 || (sameColumn && dy < best.dy)) {
        best = { index: Number(node.dataset.idx), dx, dy };
      }
    }
    if (best) setActive(best.index);
  };

  // Навигация внутри модалки; stopPropagation — чтобы глобальный keydown canvas не вмешивался.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      moveAcross(e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      insert(flat[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      editorActions.closeQuickAdd();
    }
  };

  return (
    <div
      onClick={() => editorActions.closeQuickAdd()}
      className="fixed inset-0 z-50 grid items-start justify-center overflow-auto bg-black/50 p-4 pt-[5vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-[min(1400px,94vw)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
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
        <div ref={listRef} className="min-h-0 flex-1 overflow-auto px-3 py-3">
          {flat.length === 0 ? (
            <div className="px-3 py-10 text-center text-xs text-muted-foreground">
              Ничего не найдено
            </div>
          ) : (
            <div className="flex items-start gap-5">
              {columns.map((chunks, column) => (
                <div key={column} className="min-w-0 flex-1">
                  {chunks.map((chunk) => (
                    <section key={chunk.key} className="mb-4">
                      <div
                        className={cn(
                          'mb-1.5 flex items-baseline gap-1.5 px-2 text-[14px] font-semibold',
                          // Продолжение раздела из прошлой колонки — приглушено, чтобы не читалось
                          // как начало нового раздела.
                          chunk.continued ? 'text-muted-foreground' : 'text-foreground'
                        )}
                      >
                        <span className="min-w-0 truncate">{chunk.category}</span>
                        <span className="font-mono text-[10.5px] font-normal text-muted-foreground/50">
                          {chunk.continued ? '…' : chunk.total}
                        </span>
                      </div>
                      {chunk.items.map(({ entry, index }) => (
                        <button
                          key={entry.name}
                          type="button"
                          data-idx={index}
                          data-active={index === active}
                          onMouseMove={() => setActive(index)}
                          onClick={() => insert(entry)}
                          className={cn(
                            'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[12.5px]',
                            // Часть compound'а — с отступом под своим корнем (`Alert` → `AlertTitle`).
                            isCompoundPart(entry) && 'pl-5 text-muted-foreground',
                            index === active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{displayName(entry)}</span>
                          {entry.variantGroup && !isDefaultVariant(entry) && (
                            <span className="flex-none rounded bg-primary/15 px-1 py-px text-[9.5px] font-medium text-primary">
                              {entry.variant}
                            </span>
                          )}
                        </button>
                      ))}
                    </section>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-none border-t border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">
          ↑↓ по колонке · ←→ между колонками · Enter вставить · Esc закрыть
        </div>
      </div>
    </div>
  );
}
