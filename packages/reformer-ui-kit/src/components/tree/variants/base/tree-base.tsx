import * as React from 'react';
import { ChevronRight, File, Folder, FolderOpen, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { Badge } from '@/components/badge';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/item';
import { ScrollArea } from '@/components/scroll-area';

import {
  ROOT_KEY,
  actionTargets,
  childrenOf,
  collapseNode,
  createTreeState,
  expandNode,
  filterTree,
  flattenTree,
  invalidateLevel,
  isBranch,
  levelStatus,
  rangeIds,
  setChildren,
  setLevelStatus,
  type TreeBadgeTone,
  type TreeIconRenderer,
  type TreeNode,
  type TreeRenderState,
  type TreeRow,
  type TreeState,
} from './tree-model';
import { useVirtualRows } from './use-virtual-rows';

// Tree — не примитив shadcn, а РЕЦЕПТ поверх Item/ItemGroup/ScrollArea: плотный ряд строк
// с уровнями, треугольниками и значками, каким его показывает файловый навигатор редактора.
// Собран по дереву ресурсов reformer-builder — там он и был доведён до состояния, в котором
// его не стыдно вынести в кит: с ленивым чтением уровней и виртуальным скроллом.
//
// ## Своё состояние, но каждая его ось управляема
//
// Дерево держит раскрытие, выделение, набор и прочитанные уровни само — иначе простой случай
// («покажи вот эти узлы») стоил бы потребителю хранилища. Но у каждой оси есть управляемая
// пара (`expandedIds`/`onExpandedChange` и так далее), а состояния уровня можно объявить прямо
// на узле (`loading`/`failed`). Так дерево годится и там, где хранилище уже есть и переезжать
// в компонент не должно: правила остаются у потребителя, дерево остаётся отрисовкой.

/** Высота строки, px. Фиксирована — на ней стоит виртуальный скролл. */
const ROW_HEIGHT = 24;

/** Отступ уровня, px. Величина динамическая, классом Tailwind невыразима. */
const INDENT_STEP = 12;

/** Отступ первого уровня от левого края, px. */
const INDENT_BASE = 8;

/**
 * Атрибут адреса на строке. По нему потребитель находит свою строку в обработчике, который
 * рисуется вне дерева, — например в контекстном меню, чьё содержимое Radix монтирует порталом.
 */
const ROW_ATTRIBUTE = 'data-tree-id';

const BADGE_VARIANT: Record<TreeBadgeTone, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  default: 'default',
  secondary: 'secondary',
  destructive: 'destructive',
  outline: 'outline',
};

/** Что можно выбирать: любой узел или только листья. */
export type TreeSelectable = 'all' | 'leaf';

/** Режим выбора: один узел (курсор) или курсор плюс отмеченный набор. */
export type TreeSelectionMode = 'single' | 'multiple';

/**
 * Как строка попадает в отмеченный набор. Два связных идиома, а не россыпь флагов:
 *
 * - `'modifier'` — навигатор файлов: обычный щелчок ЗАМЕНЯЕТ набор одной строкой, Ctrl/Cmd
 *   пополняет по одной, Shift берёт диапазон, `Escape` снимает набор, пробел запускает строку.
 * - `'click'` — выбор из списка: обычный щелчок и пробел ПЕРЕКЛЮЧАЮТ членство, `Escape`
 *   дереву не принадлежит и уходит наверх (в поповере его ждёт закрытие).
 */
export type TreeCheckOn = 'modifier' | 'click';

/** Обстоятельства запуска строки. */
export interface TreeActivateMeta {
  /**
   * Предпросмотр. `true` — одиночный щелчок или пробел, `false` — двойной щелчок или Enter.
   * Различение взято у редакторов кода: одиночный щелчок открывает файл временной вкладкой,
   * двойной закрепляет её. Потребителю, которому это не нужно, достаточно не смотреть в поле.
   */
  readonly preview: boolean;
}

/** Props компонента {@link Tree}. */
export interface TreeProps {
  className?: string;
  /**
   * Узлы верхнего уровня. Не задан вместе с {@link TreeProps.loadChildren} — верхний уровень
   * дерево прочитает само при появлении, передав в загрузчик `null`.
   */
  nodes?: readonly TreeNode[];
  /**
   * Ленивое чтение уровня: вызывается при первом раскрытии ветки; `null` — верхний уровень.
   * Прочитанный уровень запоминается: свернуть и раскрыть обратно обращения не стоит.
   */
  loadChildren?: (node: TreeNode | null) => Promise<readonly TreeNode[]>;
  /** Раскрытые ветки (управляемо). Без него дерево держит раскрытие само. */
  expandedIds?: readonly string[];
  /** Раскрытые ветки на старте (неуправляемо). */
  defaultExpandedIds?: readonly string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Выделенный узел (управляемо). Выделение — «где я сейчас», одна строка. */
  selectedId?: string | null;
  /** Выделенный узел на старте (неуправляемо). */
  defaultSelectedId?: string | null;
  onSelectedChange?: (id: string | null) => void;
  /**
   * Отмеченный набор (управляемо) — «что я выбрал», к чему применится действие.
   *
   * Отдельно от {@link TreeProps.selectedId}, потому что это разные вещи: выделение — одна
   * строка, туда же уходит фокус; набор — сколько угодно строк, и строка с фокусом может
   * в него не входить. Свести их в один список нельзя: тогда «где я» теряет ответ, а
   * клавиатурная навигация — точку отсчёта для диапазона.
   */
  checkedIds?: readonly string[];
  /** Отмеченный набор на старте (неуправляемо). */
  defaultCheckedIds?: readonly string[];
  onCheckedChange?: (ids: string[]) => void;
  /** Режим выбора. По умолчанию `'single'`. */
  selectionMode?: TreeSelectionMode;
  /** Как строка попадает в набор при `selectionMode='multiple'`. По умолчанию `'modifier'`. */
  checkOn?: TreeCheckOn;
  /** Что можно выбрать. По умолчанию `'all'`; `'leaf'` — режим выбора файла. */
  selectable?: TreeSelectable;
  /**
   * Дополнительный запрет выбора поверх `node.disabled`. Для запретов ДИНАМИЧЕСКИХ, которых
   * в данных узла быть не может: достигнутый потолок числа выбранных, права на конкретный файл.
   */
  isNodeDisabled?: (node: TreeNode) => boolean;
  /**
   * Запуск строки. Ветку дерево раскрывает само и наружу не сообщает: раскрытие — осмотр,
   * а не действие над узлом, и потребителю не приходится знать про состояние, которым он
   * не управляет.
   */
  onActivate?: (node: TreeNode, meta: TreeActivateMeta) => void;
  /**
   * Щелчок по строке ДО того, как дерево применит свои правила выбора. Вызвавший
   * `event.preventDefault()` берёт строку себе целиком — так потребитель со своими правилами
   * (диапазоны, наборы, свои модификаторы) остаётся хозяином, не отказываясь от отрисовки.
   */
  onRowClick?: (node: TreeNode, event: React.MouseEvent) => void;
  /** Двойной щелчок ДО запуска строки; `preventDefault` отменяет запуск. */
  onRowDoubleClick?: (node: TreeNode, event: React.MouseEvent) => void;
  /** Правый щелчок по дереву целиком: строку потребитель находит по `data-tree-id`. */
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  /** Доп. атрибуты строки: свои `data-*`, `title`, обработчики. */
  getRowProps?: (
    node: TreeNode,
    row: TreeRow
  ) => React.HTMLAttributes<HTMLElement> & Record<string, unknown>;
  /**
   * Поисковый запрос. Оставляет узлы, чей `label` содержит подстроку, и достраивает до них
   * путь; ветки на пути раскрываются на время поиска и возвращаются в прежнее состояние,
   * когда запрос убран. Видит только прочитанные уровни.
   */
  search?: string;
  /** Текст пустого дерева. По умолчанию `'Пусто'`. */
  emptyText?: string;
  /** Высота строки, px. По умолчанию 24. */
  rowHeight?: number;
  /**
   * Сколько строк показать, прежде чем включится прокрутка. Задаёт дереву ОПРЕДЕЛЁННУЮ высоту
   * по содержимому — то, что нужно списку в поповере: короткое дерево не оставляет пустоты,
   * длинное не растёт бесконечно. Без него высоту задаёт вызывающий через `className`
   * (например `h-full` в панели), и прокрутка появляется от неё.
   */
  maxRows?: number;
  /** Отступ уровня, px. По умолчанию 12. */
  indent?: number;
  /** Отступ первого уровня от левого края, px. По умолчанию 8. */
  indentBase?: number;
  /**
   * Виртуальный скролл. По умолчанию включён: раскрытый каталог реального проекта — тысячи
   * строк. Выключают там, где дерево заведомо короткое, а разметка нужна целиком, — например
   * при серверной отрисовке страницы документации.
   */
  virtualized?: boolean;
  /** Значок строки; возврат `undefined`/`null` оставляет умолчание (каталог/файл). */
  renderIcon?: TreeIconRenderer;
  /** Подпись строки; возврат `undefined`/`null` оставляет `node.label`. */
  renderLabel?: (node: TreeNode, state: TreeRenderState) => React.ReactNode;
  /** Содержимое правого края строки: свои метки, кнопки, подсказки. */
  renderActions?: (node: TreeNode, state: TreeRenderState) => React.ReactNode;
  /** Отказ чтения уровня. По умолчанию пишется в консоль: молчание здесь хуже шума. */
  onLoadError?: (error: unknown, node: TreeNode | null) => void;
  /** id контейнера дерева — по нему подпись снаружи связывается с деревом. */
  id?: string;
  /** Префикс `data-testid`: на корне, `-<id узла>` на строке, `-<id узла>-chevron` на треугольнике. */
  'data-testid'?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/**
 * Императивный handle {@link Tree}: baseline {@link FieldHandle} (focus/blur/scrollIntoView/
 * getElement на контейнере дерева) + управление уровнями и фокусом строки.
 */
export interface TreeHandle extends FieldHandle {
  /** Раскрывает ветку, дочитывая уровень, если он ещё не прочитан. */
  expand(id: string): Promise<void>;
  collapse(id: string): void;
  /** Раскрывает или сворачивает — то, что делает щелчок по треугольнику. */
  toggle(id: string): Promise<void>;
  /**
   * Перечитывает уровень: файл создан, удалён, переименован. `null` — верхний уровень.
   * Без него ленивое дерево держало бы устаревший снимок до перемонтирования.
   */
  refresh(id?: string | null): Promise<void>;
  /** Выделяет строку, доводит её до видимой области и ставит на неё фокус. */
  focusNode(id: string): void;
  /** Видимый ряд строк — то, из чего потребитель считает цель действия. */
  getRows(): readonly TreeRow[];
  /** К чему применится действие: набор, если выделение внутри него, иначе одна строка. */
  getActionTargets(): readonly TreeNode[];
}

function defaultOnLoadError(error: unknown, node: TreeNode | null): void {
  console.error(`[ui-kit] Tree: уровень «${node?.id ?? '<корень>'}» не прочитан`, error);
}

const EMPTY_CHECKED: ReadonlySet<string> = new Set<string>();

interface TreeRowViewProps {
  row: TreeRow;
  rowHeight: number;
  indent: number;
  indentBase: number;
  testIdPrefix?: string;
  renderIcon?: TreeProps['renderIcon'];
  renderLabel?: TreeProps['renderLabel'];
  renderActions?: TreeProps['renderActions'];
  getRowProps?: TreeProps['getRowProps'];
  onToggle: (id: string) => void;
  onClick: (row: TreeRow, event: React.MouseEvent) => void;
  onDoubleClick: (row: TreeRow, event: React.MouseEvent) => void;
}

function TreeRowView({
  row,
  rowHeight,
  indent,
  indentBase,
  testIdPrefix,
  renderIcon,
  renderLabel,
  renderActions,
  getRowProps,
  onToggle,
  onClick,
  onDoubleClick,
}: TreeRowViewProps): React.ReactElement {
  const { node, branch } = row;
  const active = row.selected || row.checked;
  const renderState: TreeRenderState = {
    branch,
    expanded: row.expanded,
    selected: row.selected,
    checked: row.checked,
  };
  const icon = renderIcon?.(node, renderState);
  const label = renderLabel?.(node, renderState);
  const actions = renderActions?.(node, renderState);
  const extra = getRowProps?.(node, row);

  return (
    <Item
      size="sm"
      role="treeitem"
      data-slot="tree-item"
      data-node-id={node.id}
      aria-level={row.depth + 1}
      aria-expanded={branch ? row.expanded : undefined}
      aria-selected={active}
      aria-disabled={row.disabled ? true : undefined}
      data-selected={row.selected || undefined}
      data-checked={row.checked || undefined}
      data-expanded={row.expanded || undefined}
      data-testid={testIdPrefix === undefined ? undefined : `${testIdPrefix}-${node.id}`}
      {...{ [ROW_ATTRIBUTE]: node.id }}
      tabIndex={row.selected ? 0 : -1}
      title={node.title ?? node.label}
      {...extra}
      onClick={(event) => {
        onClick(row, event);
      }}
      onDoubleClick={(event) => {
        onDoubleClick(row, event);
      }}
      className={cn(
        'cursor-pointer gap-1.5 rounded-none border-0 py-0 pr-2 text-[12px]',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
        row.disabled && 'opacity-50',
        extra?.className
      )}
      style={{ height: rowHeight, paddingLeft: indentBase + row.depth * indent, ...extra?.style }}
    >
      <ItemMedia className="size-3.5 shrink-0">
        {/* Треугольник — только у ветки; у листа его место остаётся пустым, иначе подписи
            листьев и веток одного уровня не выстраивались бы по левому краю.

            Обработчик висит на `span`, а не на самой иконке, и это не стиль: `ItemMedia`
            гасит указатель у любого вложенного `svg` (`[&_svg]:pointer-events-none` в
            `itemMediaVariants`), поэтому `onClick` на `<ChevronRight>` не вызвался бы никогда —
            щелчок проваливался бы на строку и раскрытие происходило бы «заодно», вместе
            с выбором. Ровно эта ошибка живёт сегодня в дереве ресурсов билдера.

            `aria-hidden`, а не кнопка с подписью: состояние ветки уже объявлено на строке
            через `aria-expanded`, а отдельная кнопка добавила бы в виртуальный список второй
            табстоп на каждую строку — по табу из дерева пришлось бы выходить тысячей нажатий.
            Клавиатуре треугольник не нужен: раскрытием заведуют стрелки. */}
        {branch ? (
          row.loading ? (
            <Loader2
              aria-hidden="true"
              data-slot="tree-item-loader"
              className="text-muted-foreground size-3 animate-spin"
            />
          ) : (
            <span
              role="presentation"
              data-slot="tree-item-chevron"
              data-testid={
                testIdPrefix === undefined ? undefined : `${testIdPrefix}-${node.id}-chevron`
              }
              className="flex size-3.5 items-center justify-center"
              onClick={(event) => {
                // Щелчок по треугольнику — только раскрытие: всплытие сделало бы из одного
                // щелчка два действия, раскрытие и запуск.
                event.stopPropagation();
                onToggle(node.id);
              }}
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  'text-muted-foreground size-3 transition-transform',
                  row.expanded && 'rotate-90'
                )}
              />
            </span>
          )
        ) : null}
      </ItemMedia>

      <ItemMedia className="size-3.5 shrink-0" data-slot="tree-item-icon">
        {icon !== undefined && icon !== null ? (
          icon
        ) : branch ? (
          row.expanded ? (
            <FolderOpen aria-hidden="true" className="size-3.5 opacity-70" />
          ) : (
            <Folder aria-hidden="true" className="size-3.5 opacity-70" />
          )
        ) : (
          <File aria-hidden="true" className="size-3.5 opacity-70" />
        )}
      </ItemMedia>

      <ItemContent className="min-w-0 gap-0">
        <ItemTitle
          className={cn(
            'truncate text-[12px]',
            row.failed ? 'text-destructive font-normal' : branch ? 'font-medium' : 'font-normal'
          )}
        >
          {label !== undefined && label !== null ? label : node.label}
        </ItemTitle>
      </ItemContent>

      {(node.badge !== undefined || (actions !== undefined && actions !== null)) && (
        <ItemActions className="gap-1">
          {node.badge !== undefined && (
            <Badge
              variant={BADGE_VARIANT[node.badgeTone ?? 'default']}
              className="h-4 px-1.5 py-0 text-[10px]"
            >
              {node.badge}
            </Badge>
          )}
          {actions}
        </ItemActions>
      )}
    </Item>
  );
}

/**
 * Tree (вариант `base`) — плотное дерево с уровнями, как файловый навигатор редактора.
 *
 * Уровни читаются лениво: {@link TreeProps.loadChildren} вызывается при первом раскрытии
 * ветки, прочитанное запоминается. Строки фиксированной высоты и виртуальный скролл — не
 * микрооптимизация: раскрытый каталог проекта это тысячи строк, и каждая несёт обработчики.
 *
 * Клавиатура принадлежит дереву и глушится (`stopPropagation`): стрелки, `Home`/`End`,
 * `Enter`, пробел, `Escape`. Сочетания с модификатором уходят наверх целиком — перехватив
 * `mod+c`, дерево отняло бы у команды копирования её единственную дверь.
 *
 * @example Статическое дерево, выбор только файлов
 * ```tsx
 * <Tree nodes={nodes} selectable="leaf" onActivate={(n) => open(n.id)} />
 * ```
 *
 * @example Ленивый файловый источник
 * ```tsx
 * <Tree
 *   loadChildren={(node) => fs.list(node?.id ?? '/')}
 *   selectedId={path}
 *   onSelectedChange={setPath}
 * />
 * ```
 */
const Tree = React.forwardRef<TreeHandle, TreeProps>(function Tree(
  {
    className,
    nodes,
    loadChildren,
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
    selectedId,
    defaultSelectedId = null,
    onSelectedChange,
    checkedIds,
    defaultCheckedIds,
    onCheckedChange,
    selectionMode = 'single',
    checkOn = 'modifier',
    selectable = 'all',
    isNodeDisabled,
    onActivate,
    onRowClick,
    onRowDoubleClick,
    onContextMenu,
    getRowProps,
    search = '',
    emptyText,
    rowHeight = ROW_HEIGHT,
    maxRows,
    indent = INDENT_STEP,
    indentBase = INDENT_BASE,
    virtualized = true,
    renderIcon,
    renderLabel,
    renderActions,
    onLoadError,
    id,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
  },
  ref
) {
  const roots = React.useMemo(() => nodes ?? [], [nodes]);
  const [state, setState] = React.useState<TreeState>(() =>
    createTreeState(defaultExpandedIds ?? [])
  );

  /** Уровни, чтение которых идёт: второй щелчок по треугольнику не шлёт второго запроса. */
  const inFlight = React.useRef(new Map<string, Promise<void>>());
  const errorRef = React.useRef(onLoadError ?? defaultOnLoadError);
  errorRef.current = onLoadError ?? defaultOnLoadError;

  // ── раскрытие ────────────────────────────────────────────────────────────
  const controlledExpanded = React.useMemo(
    () => (expandedIds === undefined ? null : new Set(expandedIds)),
    [expandedIds]
  );
  const viewState = React.useMemo<TreeState>(
    () => (controlledExpanded === null ? state : { ...state, expanded: controlledExpanded }),
    [state, controlledExpanded]
  );

  const commitExpanded = React.useCallback(
    (next: TreeState): void => {
      if (controlledExpanded === null) setState(next);
      onExpandedChange?.([...next.expanded]);
    },
    [controlledExpanded, onExpandedChange]
  );

  // ── выделение и набор ────────────────────────────────────────────────────
  const [ownSelected, setOwnSelected] = React.useState<string | null>(defaultSelectedId);
  const effectiveSelected = selectedId === undefined ? ownSelected : selectedId;
  const select = React.useCallback(
    (next: string | null): void => {
      if (selectedId === undefined) setOwnSelected(next);
      onSelectedChange?.(next);
    },
    [selectedId, onSelectedChange]
  );

  const [ownChecked, setOwnChecked] = React.useState<readonly string[]>(defaultCheckedIds ?? []);
  const checkedList = checkedIds ?? ownChecked;
  const effectiveChecked = React.useMemo(() => new Set(checkedList), [checkedList]);
  const check = React.useCallback(
    (next: readonly string[]): void => {
      if (checkedIds === undefined) setOwnChecked(next);
      onCheckedChange?.([...next]);
    },
    [checkedIds, onCheckedChange]
  );

  /**
   * Переключает членство строки. Считается по СПИСКУ, а не по видимым строкам: отмеченный
   * узел свёрнутой ветки в ряду отсутствует, и пересборка набора из ряда молча теряла бы его.
   */
  const toggleCheck = React.useCallback(
    (nodeId: string): void => {
      check(
        checkedList.includes(nodeId)
          ? checkedList.filter((v) => v !== nodeId)
          : [...checkedList, nodeId]
      );
    },
    [check, checkedList]
  );

  // ── чтение уровней ───────────────────────────────────────────────────────
  const nodeIndex = React.useMemo(() => {
    const index = new Map<string, TreeNode>();
    const walk = (parent: TreeNode | null): void => {
      for (const node of childrenOf(viewState, parent, roots) ?? []) {
        index.set(node.id, node);
        if (isBranch(node)) walk(node);
      }
    };
    walk(null);
    return index;
  }, [viewState, roots]);

  const load = React.useCallback(
    (node: TreeNode | null): Promise<void> => {
      if (loadChildren === undefined) return Promise.resolve();
      const key = node === null ? ROOT_KEY : node.id;
      const running = inFlight.current.get(key);
      if (running !== undefined) return running;

      setState((prev) => setLevelStatus(prev, key, 'loading'));
      const promise = loadChildren(node)
        .then((entries) => {
          setState((prev) => setChildren(prev, key, entries));
        })
        .catch((error: unknown) => {
          // Отказ уровня — состояние строки, а не авария дерева: каталог мог исчезнуть,
          // а остальные уровни при этом читаются.
          errorRef.current(error, node);
          setState((prev) => setLevelStatus(prev, key, 'failed'));
        })
        .finally(() => {
          inFlight.current.delete(key);
        });

      inFlight.current.set(key, promise);
      return promise;
    },
    [loadChildren]
  );

  const stateRef = React.useRef(state);
  stateRef.current = state;

  const ensureLevel = React.useCallback(
    (node: TreeNode | null): Promise<void> => {
      const key = node === null ? ROOT_KEY : node.id;
      // Прочитанный уровень не перечитывается: это и есть «ленивое раскрытие по уровням».
      if (levelStatus(stateRef.current, key) === 'loaded') return Promise.resolve();
      // Дети объявлены в самом узле — читать нечего.
      if (node !== null && node.children !== undefined) return Promise.resolve();
      return load(node);
    },
    [load]
  );

  // Верхний уровень читается один раз при появлении дерева: без него показывать нечего.
  const rootRequested = React.useRef(false);
  React.useEffect(() => {
    if (nodes !== undefined || loadChildren === undefined || rootRequested.current) return;
    rootRequested.current = true;
    void load(null);
  }, [nodes, loadChildren, load]);

  const expand = React.useCallback(
    async (nodeId: string): Promise<void> => {
      commitExpanded(expandNode(viewState, nodeId));
      await ensureLevel(nodeIndex.get(nodeId) ?? null);
    },
    [commitExpanded, viewState, ensureLevel, nodeIndex]
  );

  const collapse = React.useCallback(
    (nodeId: string): void => {
      commitExpanded(collapseNode(viewState, nodeId));
    },
    [commitExpanded, viewState]
  );

  const toggle = React.useCallback(
    async (nodeId: string): Promise<void> => {
      if (viewState.expanded.has(nodeId)) {
        collapse(nodeId);
        return;
      }
      await expand(nodeId);
    },
    [viewState, collapse, expand]
  );

  // ── видимые строки ───────────────────────────────────────────────────────
  const filter = React.useMemo(
    () => (search.trim() === '' ? null : filterTree(viewState, roots, search)),
    [viewState, roots, search]
  );

  const rows = React.useMemo(
    () =>
      flattenTree({
        state: viewState,
        roots,
        selectedId: effectiveSelected,
        checked: selectionMode === 'multiple' ? effectiveChecked : EMPTY_CHECKED,
        forcedExpanded: filter?.forcedExpanded,
        visible: filter?.visible,
        isDisabled: isNodeDisabled,
      }),
    [viewState, roots, effectiveSelected, effectiveChecked, selectionMode, filter, isNodeDisabled]
  );

  const virtual = useVirtualRows(rows.length, rowHeight);
  const visibleRows = virtualized ? rows.slice(virtual.start, virtual.end) : rows;
  const offsetTop = virtualized ? virtual.offsetTop : 0;

  // ── фокус ────────────────────────────────────────────────────────────────
  const treeRef = React.useRef<HTMLDivElement>(null);
  /**
   * Строка, которую нужно сфокусировать, когда она появится в DOM.
   *
   * Отдельным состоянием, потому что при виртуализации выделенной строки в документе может
   * не быть вовсе: сначала до неё доскроллит {@link useVirtualRows}, и только следующим
   * кадром её можно сфокусировать.
   */
  const [focusId, setFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focusId === null) return;
    const element = treeRef.current?.querySelector<HTMLElement>(
      `[${ROW_ATTRIBUTE}="${CSS.escape(focusId)}"]`
    );
    if (element != null) {
      element.focus();
      setFocusId(null);
    }
  }, [focusId, virtual.start, virtual.end]);

  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;

  const focusRow = React.useCallback(
    (nodeId: string): void => {
      select(nodeId);
      virtual.scrollToRow(rowsRef.current.findIndex((row) => row.node.id === nodeId));
      setFocusId(nodeId);
    },
    [select, virtual]
  );

  // ── запуск строки ────────────────────────────────────────────────────────
  const activate = React.useCallback(
    (row: TreeRow, preview: boolean): void => {
      // Ветка раскрывается, а не «открывается»: открывать её нечем, и сообщать наружу
      // «раскрыли каталог» значило бы просить потребителя знать про состояние, которым
      // он не управляет.
      //
      // Раскрытие доступно и у ЗАПРЕЩЁННОЙ к выбору ветки: запрет — про выбор, а не про
      // осмотр. Иначе достигнутый потолок числа выбранных запирал бы навигацию: погасли бы
      // и каталоги, и до файлов внутри них стало бы не добраться вовсе.
      if (row.branch) {
        void toggle(row.node.id);
        return;
      }
      if (row.disabled) return;
      onActivate?.(row.node, { preview });
    },
    [toggle, onActivate]
  );

  const canSelect = React.useCallback(
    (row: TreeRow): boolean => !row.disabled && (selectable === 'all' || !row.branch),
    [selectable]
  );

  const multiple = selectionMode === 'multiple';

  const handleRowClick = React.useCallback(
    (row: TreeRow, event: React.MouseEvent): void => {
      onRowClick?.(row.node, event);
      if (event.defaultPrevented) return;

      const nodeId = row.node.id;

      if (multiple && checkOn === 'click') {
        // Идиом выбора из списка: обычный щелчок переключает членство и ничего не запускает.
        // Строка, выбирать которую нельзя (ветка при `selectable='leaf'`), по щелчку
        // раскрывается — иначе до файлов внутри было бы не добраться мышью.
        if (canSelect(row)) {
          toggleCheck(nodeId);
          select(nodeId);
        } else {
          activate(row, true);
        }
        return;
      }

      if (multiple && (event.metaKey || event.ctrlKey)) {
        // Пополнение набора по одному; запуска при этом не происходит: человек выбирает,
        // а не смотрит.
        toggleCheck(nodeId);
        select(nodeId);
        return;
      }

      if (multiple && event.shiftKey) {
        // Диапазон от текущего выделения до этой строки, по ВИДИМЫМ строкам.
        const anchor = effectiveSelected ?? nodeId;
        check(rangeIds(rows, anchor, nodeId));
        select(nodeId);
        return;
      }

      if (canSelect(row)) {
        if (multiple) check([nodeId]);
        select(nodeId);
      }
      activate(row, true);
    },
    [
      onRowClick,
      multiple,
      checkOn,
      effectiveSelected,
      rows,
      check,
      toggleCheck,
      select,
      canSelect,
      activate,
    ]
  );

  const handleRowDoubleClick = React.useCallback(
    (row: TreeRow, event: React.MouseEvent): void => {
      onRowDoubleClick?.(row.node, event);
      if (event.defaultPrevented) return;
      activate(row, false);
    },
    [onRowDoubleClick, activate]
  );

  /**
   * Клавиатура дерева — ВВОД: обработчик стоит на самом дереве и глушит событие, поэтому
   * глобальный слой сочетаний его не увидит. Сочетания с модификатором дереву не принадлежат
   * и уходят наверх целиком.
   */
  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const at = rows.findIndex((row) => row.selected);
      const current = at >= 0 ? rows[at] : undefined;

      const move = (index: number): void => {
        const next = rows[Math.min(Math.max(index, 0), rows.length - 1)];
        if (next !== undefined) focusRow(next.node.id);
      };

      switch (event.key) {
        case 'ArrowDown':
          move(at + 1);
          break;
        case 'ArrowUp':
          move(at === -1 ? 0 : at - 1);
          break;
        case 'Home':
          move(0);
          break;
        case 'End':
          move(rows.length - 1);
          break;
        case 'ArrowRight':
          if (current !== undefined && current.branch && !current.expanded) {
            void expand(current.node.id);
          } else {
            move(at + 1);
          }
          break;
        case 'ArrowLeft':
          if (current === undefined) {
            move(0);
            break;
          }
          if (current.branch && current.expanded) {
            collapse(current.node.id);
            break;
          }
          // У листа и у свёрнутой ветки стрелка влево уходит К РОДИТЕЛЮ — так человек
          // выбирается из глубоко вложенного каталога, не считая строки вверх.
          if (current.parentId !== null && rows.some((row) => row.node.id === current.parentId)) {
            focusRow(current.parentId);
          }
          break;
        case 'Enter':
          if (current !== undefined) activate(current, false);
          break;
        case ' ':
          if (current === undefined) break;
          // В идиоме выбора из списка пробел переключает членство — то же, что делает щелчок.
          if (multiple && checkOn === 'click' && canSelect(current)) toggleCheck(current.node.id);
          else activate(current, true);
          break;
        case 'Escape':
          // Снять набор — единственный способ выйти из множественного выбора, ничего
          // при этом не запустив щелчком. В идиоме выбора из списка Escape дереву не
          // принадлежит: он уходит наверх, где его ждёт закрытие поповера или диалога.
          if (!multiple || checkOn !== 'modifier') return;
          check([]);
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [rows, focusRow, expand, collapse, activate, multiple, checkOn, canSelect, toggleCheck, check]
  );

  // ── императивный handle ──────────────────────────────────────────────────
  const refresh = React.useCallback(
    async (nodeId?: string | null): Promise<void> => {
      const key = nodeId ?? ROOT_KEY;
      setState((prev) => invalidateLevel(prev, key));
      await load(key === ROOT_KEY ? null : (nodeIndex.get(key) ?? null));
    },
    [load, nodeIndex]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      ...makeElementFieldHandle(treeRef),
      expand,
      collapse,
      toggle,
      refresh,
      focusNode: focusRow,
      getRows: () => rowsRef.current,
      getActionTargets: () => actionTargets(rowsRef.current),
    }),
    [expand, collapse, toggle, refresh, focusRow]
  );

  const body =
    rows.length === 0 ? (
      <p data-slot="tree-empty" className="text-muted-foreground px-3 py-2 text-[12px]">
        {emptyText ?? 'Пусто'}
      </p>
    ) : (
      // Распорка на всю высоту дерева; окно строк сдвинуто `translateY`, поэтому скроллбар
      // и позиции строк совпадают с невиртуальным списком.
      <div style={virtualized ? { height: virtual.totalHeight } : undefined}>
        <div style={offsetTop === 0 ? undefined : { transform: `translateY(${offsetTop}px)` }}>
          <ItemGroup>
            {visibleRows.map((row) => (
              <TreeRowView
                key={row.node.id}
                row={row}
                rowHeight={rowHeight}
                indent={indent}
                indentBase={indentBase}
                testIdPrefix={dataTestId}
                renderIcon={renderIcon}
                renderLabel={renderLabel}
                renderActions={renderActions}
                getRowProps={getRowProps}
                onToggle={(nodeId) => {
                  void toggle(nodeId);
                }}
                onClick={handleRowClick}
                onDoubleClick={handleRowDoubleClick}
              />
            ))}
          </ItemGroup>
        </div>
      </div>
    );

  // `py-1` контейнера строк — те самые 8 px, без которых последняя строка прижималась бы
  // к нижнему краю ровно на высоту прокрутки.
  const boundedHeight =
    maxRows === undefined || rows.length === 0
      ? undefined
      : Math.min(rows.length, Math.max(1, maxRows)) * rowHeight + 8;

  return (
    // Ссылка виртуализации — на обёртке, а не на `ScrollArea`: та функциональная и в React 18
    // ref-пропа не принимает, а вьюпорт хук всё равно находит запросом внутрь.
    <div
      ref={virtual.scrollRef}
      className={cn('min-h-0', className)}
      style={boundedHeight === undefined ? undefined : { height: boundedHeight }}
    >
      <ScrollArea className="h-full">
        <div
          ref={treeRef}
          id={id}
          role="tree"
          data-slot="tree"
          data-testid={dataTestId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
          // Пока ни одна строка не выделена, точкой входа Tab служит само дерево; как только
          // выделение появилось, вход идёт в строку — иначе Tab останавливался бы дважды.
          tabIndex={rows.some((row) => row.selected) ? -1 : 0}
          onKeyDown={onKeyDown}
          onContextMenu={onContextMenu}
          className="py-1 outline-none"
        >
          {body}
        </div>
      </ScrollArea>
    </div>
  );
});
Tree.displayName = 'Tree';

export { Tree, ROW_HEIGHT as TREE_ROW_HEIGHT, ROW_ATTRIBUTE as TREE_ROW_ATTRIBUTE };
export type { TreeRenderState };
