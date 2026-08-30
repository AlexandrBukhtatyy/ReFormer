/**
 * Дерево ресурсов. Правила живут в `./resource-tree`, `./menu` и `./resource-menu`,
 * здесь — отрисовка и ввод.
 *
 * Компонент не смонтирован оболочкой и не может быть ею смонтирован: место в раскладке —
 * это панель, а панели приходят вкладами, которых у Host нет и быть не может. Поэтому дерево
 * экспортируется как готовое тело панели: плагин файлов внесёт `PanelContribution`, чей `Body`
 * — вот этот компонент. Так навигация остаётся платформенной, а место для неё — предметным
 * решением того, кто собирает продукт.
 *
 * ## Плотная строка — это требование к дереву, а не вкус
 *
 * Строка фиксирована в {@link ROW_HEIGHT} пикселей, и на этом стоит виртуализация: в DOM
 * живёт только видимое окно. Причина не в микросекундах отрисовки — в том, что раскрытый
 * каталог реального проекта это тысячи строк, и каждая несёт свои обработчики.
 *
 * ## Клавиатура разделена между деревом и реестром команд
 *
 * Навигация (стрелки, Home/End, Enter, пробел, Escape) — ВВОД: он принадлежит дереву,
 * обрабатывается здесь и глушится `stopPropagation`, поэтому глобальный слой сочетаний
 * его не видит. Действия (переименовать, удалить, копировать, вставить) — КОМАНДЫ: они
 * объявлены плагином с сочетанием и предикатом «фокус в дереве», и дерево о них не знает
 * ничего. Именно поэтому здесь нет ни `F2`, ни `Delete`: перехватив их, дерево забрало бы
 * у команды её единственную дверь.
 *
 * ## Контекстное меню — одно на всё дерево
 *
 * Не по строке на меню: при виртуализации это дало бы сотню корней Radix со своими
 * подписками вместо одного. Строка, по которой щёлкнули, определяется в момент открытия
 * по `data-resource-id` ближайшего предка — заодно так работает щелчок по пустому месту
 * панели, где строки нет вовсе, а «Новый файл…» осмысленен.
 *
 * Само меню строится ТОЙ ЖЕ моделью, что шапка приложения (`./menu`): контекстное меню —
 * не второй механизм, а другой корень (`resource/context`). Поэтому пункт в меню дерева
 * пишется таким же вкладом, как пункт в «Файле», и остаётся ссылкой на команду — доступной
 * из палитры, с клавиши и ассистенту.
 *
 * ## Декорации получают ленивую пробу
 *
 * `decorate` синхронна, а `readText` в тип рабочей области дерева не входит вовсе. Проба
 * над содержимым собирается ТОЛЬКО если её передали пропом, и даже тогда не читает ничего,
 * пока вклад сам не спросит. Раскрытие уровня стоит одного листинга — это правило, а не
 * намерение.
 *
 * ## Пометка, зависящая от состояния снаружи дерева
 *
 * `decorate` спрашивают в отрисовке, а перерисовку заказывает React. Вкладу, чей ответ
 * зависит от `ref` (как «это схема формы»), этого хватает: `ref` приходит вместе со
 * строкой. Вкладу, чей ответ зависит от чужого состояния (диагностика), — нет: находки
 * приходят от валидатора, и дереву перерисовываться не с чего. Поэтому вклад вправе
 * сказать «спроси меня заново» (`onDidChange`), и {@link useDecorationRevision} на это
 * подписан. Правило то же, что у локали в `useLocale`: хук ничего не считает, он делает
 * чужое состояние поводом перерисоваться.
 *
 * @module host/ui/ResourceTree
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import { ChevronRight, File, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { Badge } from '@reformer/ui-kit/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@reformer/ui-kit/context-menu';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@reformer/ui-kit/item';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@reformer/ui-kit/tooltip';
import type { ResourceId, ResourceRef } from '../primitives/resource';
import { NEUTRAL_WHEN_CONTEXT, type WhenContext } from '../primitives/when-context';
import type { RootI18nService } from '../services/i18n/i18n';
import {
  ResourceDecorationPoint,
  decorationTooltip,
  mergeDecorations,
  observeDecorations,
  type DecorationEntry,
  type DecorationTone,
  type MergedDecoration,
} from './decorations';
import type { CommandRegistry } from '../primitives/command';
import { createLazyEditorProbe, createUnreadableProbe, type ReadResourceText } from './editors';
import { detectPlatformModifier, formatChord } from './keybindings';
import { buildMenu, MenuPoint, type MenuActionNode, type MenuNode } from './menu';
import { RESOURCE_CONTEXT_MENU, resourceMenuTarget, parentIdOf } from './resource-menu';
import {
  actionTargets,
  flattenTree,
  rangeIds,
  type ResourceTreeStore,
  type TreeRow,
} from './resource-tree';
import { useContributions, useLocale, type ExtensionReader } from './usePanels';
import { useVirtualRows } from './use-virtual-rows';
import { useResourceTree } from './useWorkspaceViews';

/** Тон пометки → вариант значка кита. Соответствие визуальное, поэтому живёт в отрисовке. */
const BADGE_VARIANT: Readonly<
  Record<DecorationTone, 'default' | 'secondary' | 'destructive' | 'outline'>
> = Object.freeze({
  default: 'secondary',
  accent: 'default',
  warning: 'outline',
  danger: 'destructive',
});

/**
 * Перерисовка дерева по сигналу вклада декорации.
 *
 * `useReducer` вместо `useSyncExternalStore`: у сигнала нет снимка — он не несёт значения
 * вовсе, а требование стабильности снимка при этом никуда не девается, и подсовывать ему
 * счётчик значило бы заводить состояние ради того, чтобы его не читать. Функция-диспетчер
 * стабильна по контракту React, поэтому эффект переподписывается только при смене состава
 * вкладов.
 */
function useDecorationRevision(entries: readonly DecorationEntry[]): void {
  const [, bump] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    const subscription = observeDecorations(entries, bump);
    return () => {
      subscription.dispose();
    };
  }, [entries]);
}

export interface ResourceTreeProps {
  readonly tree: ResourceTreeStore;
  readonly extensions: ExtensionReader;
  readonly i18n: RootI18nService;
  /**
   * Открыть ресурс. Обычно — `documents.open`; дерево не знает ни про вкладки, ни про редакторы.
   * `preview` повторяет режим вкладок: одиночный щелчок — временная, двойной — закреплённая.
   */
  readonly onOpen?: (id: ResourceId, options: { readonly preview: boolean }) => void;
  /**
   * Чтение содержимого — ТОЛЬКО для проб декораций.
   *
   * Дерево само им не пользуется никогда: раскрытие уровня — это `list`, и ничего больше.
   * Без пропа вклад, которому мало ссылки, получит пробу с честным отказом.
   */
  readonly readText?: ReadResourceText;
  /**
   * Реестр команд — для контекстного меню.
   *
   * Без него меню не показывается вовсе, и это правильная деградация: пункт меню — ссылка
   * на команду, а без реестра ссылке некуда вести. Дерево при этом остаётся полностью
   * работоспособным: навигация и открытие команд не требуют.
   */
  readonly commands?: TreeCommands;
  /**
   * Контекст применимости. Читается В МОМЕНТ открытия меню, без подписки: «виден ли пункт»
   * спрашивают на щелчке, а перерисовывать дерево на каждое движение фокуса незачем.
   */
  readonly whenContext?: () => WhenContext;
}

/**
 * Реестр команд в объёме, нужном контекстному меню: прочитать, спросить применимость,
 * выполнить. `Pick` от настоящего реестра — форма обязана совпадать буква в букву, иначе
 * расхождение вскроется на композиции, а не на типах.
 */
export type TreeCommands = Pick<CommandRegistry, 'get' | 'isEnabled' | 'execute'>;

/** Высота строки. Фиксирована — на ней стоит виртуальный скролл. */
const ROW_HEIGHT = 24;

/** Отступ уровня в пикселях. Динамическая величина, классом Tailwind невыразима. */
const INDENT_STEP = 12;
const INDENT_BASE = 8;

/** Атрибут, по которому щелчок правой кнопкой находит свою строку. */
const ROW_ATTRIBUTE = 'data-resource-id';

function TreeRowView({
  row,
  decoration,
  tooltip,
  onToggle,
  onClick,
  onDoubleClick,
}: {
  row: TreeRow;
  decoration: MergedDecoration | null;
  tooltip: string | null;
  onToggle: (id: ResourceId) => void;
  onClick: (row: TreeRow, event: ReactMouseEvent) => void;
  onDoubleClick: (row: TreeRow) => void;
}): ReactElement {
  const isDirectory = row.ref.kind === 'directory';
  const Icon = decoration?.icon;
  const active = row.selected || row.checked;

  return (
    <Item
      size="sm"
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={isDirectory ? row.expanded : undefined}
      aria-selected={row.selected || row.checked}
      data-selected={row.selected || undefined}
      data-checked={row.checked || undefined}
      {...{ [ROW_ATTRIBUTE]: row.ref.id }}
      tabIndex={row.selected ? 0 : -1}
      title={row.ref.path}
      onClick={(event) => {
        onClick(row, event);
      }}
      onDoubleClick={() => {
        onDoubleClick(row);
      }}
      className={
        active
          ? 'bg-accent text-accent-foreground h-6 cursor-pointer gap-1.5 rounded-none border-0 py-0 pr-2 text-[12px]'
          : 'hover:bg-accent/50 h-6 cursor-pointer gap-1.5 rounded-none border-0 py-0 pr-2 text-[12px]'
      }
      style={{ paddingLeft: INDENT_BASE + row.depth * INDENT_STEP }}
    >
      <ItemMedia className="size-3.5 shrink-0">
        {/* Треугольник — только у каталогов; у файлов его место остаётся пустым, иначе
            имена файлов и каталогов одного уровня не выстраивались бы по левому краю. */}
        {isDirectory ? (
          row.loading ? (
            <Loader2 aria-hidden="true" className="text-muted-foreground size-3 animate-spin" />
          ) : (
            <ChevronRight
              aria-hidden="true"
              data-testid={`tree-chevron-${row.ref.id}`}
              className={
                row.expanded
                  ? 'text-muted-foreground size-3 rotate-90 transition-transform'
                  : 'text-muted-foreground size-3 transition-transform'
              }
              onClick={(event) => {
                // Щелчок по треугольнику — только раскрытие: открывать каталог нечем,
                // а всплытие сделало бы из одного щелчка два действия.
                event.stopPropagation();
                onToggle(row.ref.id);
              }}
            />
          )
        ) : null}
      </ItemMedia>

      <ItemMedia className="size-3.5 shrink-0">
        {/* Значок вклада бьёт умолчание: «это схема формы» знает вклад, а не дерево.
            Поштучный импорт из `lucide-react`, а не `@reformer/ui-kit/icon`: тот объявляет
            себя opt-in, потому что тянет весь набор значков разом. */}
        {Icon !== undefined ? (
          <Icon />
        ) : isDirectory ? (
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
          className={
            row.failed
              ? 'text-destructive truncate text-[12px] font-normal'
              : isDirectory
                ? 'truncate text-[12px] font-medium'
                : 'truncate text-[12px] font-normal'
          }
        >
          {row.ref.name}
        </ItemTitle>
      </ItemContent>

      <ItemActions className="gap-1">
        {decoration?.badge !== undefined &&
          (tooltip === null ? (
            <Badge
              variant={BADGE_VARIANT[decoration.tone ?? 'default']}
              className="h-4 px-1.5 py-0 text-[10px]"
            >
              {decoration.badge}
            </Badge>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={BADGE_VARIANT[decoration.tone ?? 'default']}
                  className="h-4 px-1.5 py-0 text-[10px]"
                >
                  {decoration.badge}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ))}
      </ItemActions>
    </Item>
  );
}

export function ResourceTree({
  tree,
  extensions,
  i18n,
  onOpen,
  readText,
  commands,
  whenContext,
}: ResourceTreeProps): ReactElement {
  const state = useResourceTree(tree);
  const decorations = useContributions(extensions, ResourceDecorationPoint);
  const menus = useContributions(extensions, MenuPoint);
  useDecorationRevision(decorations);
  useLocale(i18n);
  const { t } = i18n;

  // Верхний уровень читается один раз при появлении дерева: без него показывать нечего,
  // а раскрывать его человеку было бы нечего раскрывать.
  useEffect(() => {
    void tree.expand(state.rootId);
  }, [tree, state.rootId]);

  const rows = useMemo(() => flattenTree(state), [state]);
  const virtual = useVirtualRows(rows.length, ROW_HEIGHT);
  const modifier = useMemo(() => detectPlatformModifier(), []);

  const treeRef = useRef<HTMLDivElement>(null);
  /**
   * Строка, которую нужно сфокусировать, когда она появится в DOM.
   *
   * Отдельным состоянием, потому что при виртуализации выделенной строки в документе может
   * не быть вовсе: сначала до неё доскроллит {@link useVirtualRows}, и только следующим
   * кадром её можно сфокусировать.
   */
  const [focusId, setFocusId] = useState<ResourceId | null>(null);

  useEffect(() => {
    if (focusId === null) return;
    const element = treeRef.current?.querySelector<HTMLElement>(
      `[${ROW_ATTRIBUTE}="${CSS.escape(focusId)}"]`
    );
    if (element !== null && element !== undefined) {
      element.focus();
      setFocusId(null);
    }
  }, [focusId, virtual.start, virtual.end]);

  const decorate = useCallback(
    (ref: ResourceRef, entries: readonly DecorationEntry[]): MergedDecoration | null =>
      mergeDecorations(
        entries,
        ref,
        readText === undefined
          ? createUnreadableProbe(ref)
          : createLazyEditorProbe(() => readText(ref.id))
      ),
    [readText]
  );

  /** Выделяет строку и доводит её до видимой области вместе с фокусом. */
  const focusRow = useCallback(
    (id: ResourceId): void => {
      tree.select(id);
      virtual.scrollToRow(rows.findIndex((row) => row.ref.id === id));
      setFocusId(id);
    },
    [tree, virtual, rows]
  );

  const open = useCallback(
    (ref: ResourceRef, preview: boolean): void => {
      if (ref.kind === 'directory') {
        void tree.toggle(ref.id);
        return;
      }
      onOpen?.(ref.id, { preview });
    },
    [tree, onOpen]
  );

  const onRowClick = useCallback(
    (row: TreeRow, event: ReactMouseEvent): void => {
      const id = row.ref.id;

      // Ctrl/Cmd — набор пополняется по одному; открытие при этом не происходит:
      // человек выбирает, а не смотрит.
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        tree.toggleCheck(id);
        tree.select(id);
        return;
      }

      // Shift — диапазон от текущего выделения до этой строки, по видимым строкам.
      if (event.shiftKey) {
        event.preventDefault();
        const anchor = state.selectedId ?? id;
        tree.check(rangeIds(rows, anchor, id));
        tree.select(id);
        return;
      }

      tree.check([id]);
      tree.select(id);
      // Как в VSCode: одиночный щелчок открывает файл временной вкладкой (следующий такой
      // щелчок займёт её слот), двойной — закрепляет её за файлом.
      open(row.ref, true);
    },
    [tree, state.selectedId, rows, open]
  );

  const onRowDoubleClick = useCallback(
    (row: TreeRow): void => {
      open(row.ref, false);
    },
    [open]
  );

  /**
   * Клавиатура дерева — ввод, а не команды: обработчик стоит на самом дереве и глушит
   * событие, поэтому глобальный слой сочетаний его не увидит (то же правило, что у палитры).
   *
   * Всё, чего здесь нет, уходит наверх намеренно: `F2`, `Delete` и копирование — это
   * команды плагина, объявленные с предикатом «фокус в дереве».
   */
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      // Сочетания с модификатором принадлежат командам целиком: перехватив здесь `mod+c`,
      // дерево отняло бы у команды копирования её единственную дверь.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const at = rows.findIndex((row) => row.selected);
      const current = at >= 0 ? rows[at] : undefined;

      const move = (index: number): void => {
        const next = rows[Math.min(Math.max(index, 0), rows.length - 1)];
        if (next !== undefined) focusRow(next.ref.id);
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
          if (current !== undefined && current.ref.kind === 'directory' && !current.expanded) {
            void tree.expand(current.ref.id);
          } else {
            move(at + 1);
          }
          break;
        case 'ArrowLeft':
          if (current === undefined) {
            move(0);
            break;
          }
          if (current.ref.kind === 'directory' && current.expanded) {
            tree.collapse(current.ref.id);
            break;
          }
          // У файла и у свёрнутого каталога стрелка влево уходит К РОДИТЕЛЮ — так человек
          // выбирается из глубоко вложенного каталога, не считая строки вверх.
          {
            const parent = parentIdOf(current.ref);
            if (parent !== null && rows.some((row) => row.ref.id === parent)) focusRow(parent);
          }
          break;
        case 'Enter':
          if (current !== undefined) open(current.ref, false);
          break;
        case ' ':
          if (current !== undefined) open(current.ref, true);
          break;
        case 'Escape':
          // Снять набор — единственный способ выйти из множественного выбора, не открыв
          // при этом чего-нибудь щелчком.
          tree.check([]);
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [rows, tree, focusRow, open]
  );

  /**
   * Строка, по которой открыли меню. `null` — щёлкнули мимо строк, и это законный случай.
   *
   * Состоянием, а не вычислением при отрисовке: Radix монтирует содержимое меню отдельно
   * от того щелчка, который его открыл.
   */
  const [menuRow, setMenuRow] = useState<ResourceRef | null>(null);

  const onContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      const element = (event.target as HTMLElement).closest<HTMLElement>(`[${ROW_ATTRIBUTE}]`);
      const id = element?.getAttribute(ROW_ATTRIBUTE) ?? null;
      const row = id === null ? undefined : rows.find((item) => item.ref.id === id);
      setMenuRow(row?.ref ?? null);
      if (row === undefined) return;
      // Щелчок по строке ВНЕ набора выделяет её одну: иначе «Удалить» унесло бы то, чего
      // человек не видит выделенным. Щелчок по строке набора набор сохраняет.
      if (!row.checked) tree.check([row.ref.id]);
      tree.select(row.ref.id);
    },
    [rows, tree]
  );

  const menu = useMemo(() => {
    if (commands === undefined) return [];
    // Выделение считается по состоянию ПОСЛЕ щелчка правой кнопкой: он его уже поправил.
    const selection = menuRow === null ? [] : actionTargets(rows);
    return buildMenu(
      {
        entries: menus,
        ctx: whenContext?.() ?? NEUTRAL_WHEN_CONTEXT,
        target: resourceMenuTarget(menuRow, selection, state.rootId),
        commands,
        // Заголовок разрешается словарём ВЛАДЕЛЬЦА — команды или вклада; ключ Host ищется
        // в словаре Host. Иначе команда плагина показывала бы маркер промаха.
        translate: (key, owner) =>
          owner?.pluginId === undefined ? i18n.t(key) : i18n.forPlugin(owner.pluginId).t(key),
        execute: (commandId, args) => {
          void commands.execute(commandId, args).catch((error: unknown) => {
            console.error(`[shell] команда «${commandId}» из меню дерева отказала`, error);
          });
        },
        onIssue: (issue) => {
          // Молчание здесь хуже шума: пункт, промахнувшийся мимо команды, просто не
          // появляется, и без сообщения виновника ищут чтением всех плагинов сразу.
          console.warn(
            `[shell] меню дерева: «${issue.entryId}» — ${issue.kind}${
              issue.target === undefined ? '' : ` (${issue.target})`
            }`
          );
        },
      },
      RESOURCE_CONTEXT_MENU
    );
  }, [commands, menus, menuRow, rows, state.rootId, i18n, whenContext]);

  const renderNode = (node: MenuNode): ReactElement | null => {
    if (node.kind === 'separator') return <ContextMenuSeparator key={node.id} />;
    if (node.kind === 'submenu') {
      return (
        <ContextMenuSub key={node.id}>
          <ContextMenuSubTrigger>{node.title}</ContextMenuSubTrigger>
          <ContextMenuSubContent>{node.items.map(renderNode)}</ContextMenuSubContent>
        </ContextMenuSub>
      );
    }
    return renderAction(node);
  };

  const renderAction = (node: MenuActionNode): ReactElement => (
    <ContextMenuItem key={node.id} disabled={!node.enabled} onSelect={node.run}>
      {node.title}
      {node.chord !== undefined && (
        <ContextMenuShortcut>{formatChord(node.chord, modifier)}</ContextMenuShortcut>
      )}
    </ContextMenuItem>
  );

  const body = (
    <ScrollArea ref={virtual.scrollRef} className="h-full">
      <ItemGroup
        ref={treeRef}
        role="tree"
        aria-label={t('shell.tree.label')}
        data-focus-zone="tree"
        tabIndex={rows.some((row) => row.selected) ? -1 : 0}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
        className="py-1 outline-none"
      >
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-[12px]">{t('shell.tree.empty')}</p>
        ) : (
          // Распорка на всю высоту дерева; окно строк сдвинуто `translateY`, поэтому
          // скроллбар и позиции строк совпадают с невиртуальным списком.
          <div style={{ height: virtual.totalHeight }}>
            <div style={{ transform: `translateY(${virtual.offsetTop}px)` }}>
              {rows.slice(virtual.start, virtual.end).map((row) => {
                const decoration = decorate(row.ref, decorations);
                return (
                  <TreeRowView
                    key={row.ref.id}
                    row={row}
                    decoration={decoration}
                    tooltip={decoration === null ? null : decorationTooltip(i18n, decoration)}
                    onToggle={(id) => {
                      void tree.toggle(id);
                    }}
                    onClick={onRowClick}
                    onDoubleClick={onRowDoubleClick}
                  />
                );
              })}
            </div>
          </div>
        )}
      </ItemGroup>
    </ScrollArea>
  );

  // Без реестра команд меню не существует, и обёртка вокруг дерева не нужна: пустой корень
  // Radix ловил бы правый щелчок и показывал пустую рамку.
  if (commands === undefined) {
    return (
      <TooltipProvider>
        <div className="h-full">{body}</div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="h-full">{body}</div>
        </ContextMenuTrigger>
        {/* Меню объявляет себя зоной дерева, хотя рисуется порталом снаружи. Это не уловка:
            пока меню открыто, человек работает с деревом, и команды с предикатом «фокус
            в дереве» обязаны оставаться доступными — иначе Radix, забравший фокус себе,
            гасил бы каждый пункт ровно в тот момент, когда его собираются нажать. */}
        <ContextMenuContent data-focus-zone="tree" className="w-60">
          {menu.length === 0 ? (
            <ContextMenuItem disabled>{t('shell.tree.menu.empty')}</ContextMenuItem>
          ) : (
            menu.map(renderNode)
          )}
        </ContextMenuContent>
      </ContextMenu>
    </TooltipProvider>
  );
}
