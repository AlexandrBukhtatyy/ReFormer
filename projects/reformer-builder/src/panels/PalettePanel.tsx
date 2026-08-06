/**
 * Палитра компонентов (спека §8): каталог, сгруппированный по категориям, с поиском.
 * В этом слайсе — клик добавляет узел в ближайший контейнер выделения (или в корень);
 * полноценный drag-drop — в следующем слайсе.
 *
 * @module reformer-builder/panels/PalettePanel
 */

import { useMemo, useState } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { Input, ScrollArea } from '@reformer/ui-kit';
import { isContainerNode, parseOperator, type JsonFormSchema } from '@reformer/renderer-json';
import { appendNode, findByPath, isLeafComponent, parentNodePath, type JsonPath } from '../model';
import {
  displayName,
  getCatalog,
  groupByCategory as groupEntriesByCategory,
  htmlTag,
  isCompoundPart,
  partsOf,
  type CatalogEntry,
} from '../catalog';
import { collapseToDefaults } from '../catalog/variants';
import { getRuntimeConfig } from '../config/state';
import { editorActions, editorStore, useActiveTab, useSelectionPath } from '../store';
import { clearDrag, setDrag } from '../dnd/drag-state';

/** Разделы, свёрнутые по умолчанию (спека §8), если клиент не переопределил. */
const DEFAULT_COLLAPSED = ['HTML', 'Типографика', 'Оверлеи', 'Навигация', 'Чат'];

/** Ключ свёрнутости контекстного раздела частей (один на все корни — заголовок меняется). */
const PARTS_CATEGORY = 'Части';

/** Текстовый глиф-бейдж элемента палитры (аббревиатура типа, как в дизайн-макете). */
const HTML_GLYPH: Record<string, string> = {
  // Блоки
  div: 'div',
  section: 'sec',
  article: 'art',
  aside: 'as',
  header: 'hd',
  footer: 'ft',
  nav: 'nav',
  main: 'mn',
  fieldset: 'fs',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  hr: 'hr',
  img: 'img',
  // Типографика
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  span: 'sp',
  strong: 'b',
  em: 'i',
  small: 'sm',
  blockquote: 'bq',
  code: 'cd',
  pre: 'pre',
  a: 'a',
  label: 'lb',
  br: 'br',
};
const GLYPH_BY_NAME: Record<string, string> = {
  Input: 'In',
  InputPassword: 'Ip',
  InputMask: 'Im',
  InputOTP: 'Io',
  Textarea: 'Tx',
  DatePicker: 'Dt',
  Calendar: 'Ca',
  FileUpload: 'Up',
  FileUploadAvatar: 'Av',
  Select: 'Se',
  NativeSelect: 'Ns',
  Combobox: 'Cb',
  RadioGroup: 'Rg',
  Checkbox: 'Ck',
  Switch: 'Sw',
  Slider: 'Sl',
  Toggle: 'Tg',
  ToggleGroup: 'Tg',
  Box: 'Bx',
  Section: 'Sc',
  FormArray: 'Fa',
};

function glyph(entry: CatalogEntry): string {
  // Клиентский конфиг может задать глиф по имени компонента (приоритет над дефолтами).
  const override = getRuntimeConfig().palette?.glyphs?.[entry.name];
  if (override) return override;
  const tag = htmlTag(entry.name);
  if (tag) return HTML_GLYPH[tag] ?? tag.slice(0, 3);
  return (
    GLYPH_BY_NAME[entry.name] ??
    (entry.name[0]?.toUpperCase() ?? '') + (entry.name[1]?.toLowerCase() ?? '')
  );
}

function groupByCategory(catalog: CatalogEntry[], q: string): Array<[string, CatalogEntry[]]> {
  const needle = q.trim().toLowerCase();
  // Части compound'ов (AlertTitle, CardHeader…) в общем списке не показываем — их место в разделе
  // «Части: {корень}», который появляется по контексту выделения. Поиском они находятся всегда.
  const filtered = needle
    ? catalog.filter((e) => e.name.toLowerCase().includes(needle))
    : catalog.filter((e) => !isCompoundPart(e));
  // Палитра — один дефолт-вариант на группу (не-дефолтные варианты доступны в QuickAdd). При поиске
  // конкретного варианта (дефолт не в выборке) collapseToDefaults покажет сам найденный вариант.
  return groupEntriesByCategory(collapseToDefaults(filtered));
}

/**
 * Корень compound'а, внутри которого стоит выделение (сам узел тоже считается). Нужен, чтобы палитра
 * предложила именно его части: у `Alert` содержимое живёт в `AlertTitle`/`AlertDescription`, а голый
 * текст в корне рассыпается по словам (grid-колонка нулевой ширины).
 */
function compoundContext(schema: JsonFormSchema, selPath: JsonPath | null): string | null {
  let path: JsonPath | null = selPath;
  while (path && path.length) {
    const node = findByPath(schema, path);
    const name = parseOperator((node as { component?: unknown } | undefined)?.component);
    if (name?.op === 'component' && partsOf(name.arg).length) return name.arg;
    path = parentNodePath(path);
  }
  return null;
}

/** Ближайший контейнер-слот от выделения (или корень) — куда добавить новый узел. */
function resolveSlot(schema: JsonFormSchema, selPath: JsonPath | null): JsonPath | null {
  let path: JsonPath | null = selPath;
  while (path && path.length) {
    const node = findByPath(schema, path);
    // Листовой узел (Icon/Separator/…) детей не держит — поднимаемся к родителю (вставка рядом).
    if (node && !isLeafComponent(node) && isContainerNode(node)) return [...path, 'children'];
    path = parentNodePath(path);
  }
  return !isLeafComponent(schema.root) && isContainerNode(schema.root)
    ? ['root', 'children']
    : null;
}

/** Раздел палитры: свёртываемый заголовок + карточки элементов (общий для категорий и «Частей»). */
function PaletteSection({
  title,
  items,
  open,
  onToggle,
  onPick,
}: {
  title: string;
  items: CatalogEntry[];
  open: boolean;
  onToggle: () => void;
  onPick: (entry: CatalogEntry) => void;
}) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={`h-3 w-3 flex-none transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="flex-none font-mono text-[10px] font-normal text-muted-foreground/50">
          {items.length}
        </span>
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
              onClick={() => onPick(e)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-muted"
            >
              <span className="grid h-5 min-w-5 flex-none place-items-center rounded border border-border bg-background px-1 font-mono text-[9px] font-semibold text-muted-foreground">
                {glyph(e)}
              </span>
              <span className="min-w-0 flex-1 truncate">{displayName(e)}</span>
              <GripVertical className="h-3.5 w-3.5 flex-none text-muted-foreground/40" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PalettePanel() {
  const [q, setQ] = useState('');
  const catalog = getCatalog();
  const groups = useMemo(() => groupByCategory(catalog, q), [catalog, q]);
  // Контекстный раздел «Части: {корень}»: когда выделение стоит внутри compound'а, его части нужны
  // здесь и сейчас — в общем списке их нет. При активном поиске раздел не нужен: части и так в выдаче.
  const selectionPath = useSelectionPath();
  const activeTab = useActiveTab();
  const compoundRoot = useMemo(
    () => (activeTab ? compoundContext(activeTab.schema, selectionPath) : null),
    [activeTab, selectionPath]
  );
  const contextParts = useMemo(
    () => (compoundRoot && !q.trim() ? partsOf(compoundRoot) : []),
    [compoundRoot, q]
  );
  // Форс-категории раскрыты; вспомогательные (HTML/оверлеи/навигация/чат) свёрнуты по умолчанию
  // (спека §8, дизайн-макет; клиент может переопределить `palette.collapsedByDefault`). Поиск
  // временно раскрывает все разделы.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const list = getRuntimeConfig().palette?.collapsedByDefault ?? DEFAULT_COLLAPSED;
    return Object.fromEntries(list.map((c) => [c, true]));
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
        {contextParts.length > 0 && compoundRoot && (
          <PaletteSection
            title={`Части: ${compoundRoot}`}
            items={contextParts}
            open={isOpen(PARTS_CATEGORY)}
            onToggle={() => toggle(PARTS_CATEGORY)}
            onPick={pick}
          />
        )}
        {groups.map(([cat, items]) => (
          <PaletteSection
            key={cat}
            title={cat}
            items={items}
            open={isOpen(cat)}
            onToggle={() => toggle(cat)}
            onPick={pick}
          />
        ))}
      </ScrollArea>
    </div>
  );
}
