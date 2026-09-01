/**
 * Дерево ресурсов. Правила живут в `./resource-tree`, `./menu` и `./resource-menu`,
 * отрисовка — в `Tree` из `@reformer/ui-kit`, здесь — связка одного с другим.
 *
 * Компонент не смонтирован оболочкой и не может быть ею смонтирован: место в раскладке —
 * это панель, а панели приходят вкладами, которых у Host нет и быть не может. Поэтому дерево
 * экспортируется как готовое тело панели: плагин файлов внесёт `PanelContribution`, чей `Body`
 * — вот этот компонент. Так навигация остаётся платформенной, а место для неё — предметным
 * решением того, кто собирает продукт.
 *
 * ## Что здесь есть и чего здесь больше нет
 *
 * Плотная строка, отступы уровня, треугольник, значки каталога и файла, клавиатурная навигация
 * и виртуальный скролл переехали в кит: это не свойства ДЕРЕВА РЕСУРСОВ, а свойства дерева
 * вообще, и держать их здесь значило бы чинить одну и ту же ошибку дважды — второй раз
 * в комбобоксе выбора файла, который тем же деревом и собран.
 *
 * Здесь осталось ровно предметное: хранилище уровней (`./resource-tree`), декорации вкладов,
 * контекстное меню, реестр команд и словарь. Кит про них не знает и знать не должен.
 *
 * ## Хранилище остаётся здесь, а не переезжает в кит
 *
 * Кит умеет читать уровни сам (`loadChildren`), но здесь это не используется: уровни —
 * не только источник строк, но и то, к чему обращаются команды, декорации и меню, а их
 * правила проверяются без браузера. Поэтому дерево кита стоит в ПОЛНОСТЬЮ УПРАВЛЯЕМОМ
 * режиме: раскрытие, выделение, набор и состояния чтения приходят из снимка хранилища,
 * а всякое намерение возвращается в него же.
 *
 * ## Контекстное меню — одно на всё дерево
 *
 * Не по строке на меню: при виртуализации это дало бы сотню корней Radix со своими
 * подписками вместо одного. Строка, по которой щёлкнули, определяется в момент открытия
 * по `data-tree-id` ближайшего предка — заодно так работает щелчок по пустому месту
 * панели, где строки нет вовсе, а «Новый файл…» осмысленен.
 *
 * Само меню строится ТОЙ ЖЕ моделью, что шапка приложения (`./menu`): контекстное меню —
 * не второй механизм, а другой корень (`resource/context`).
 *
 * ## Клавиатура разделена между деревом и реестром команд
 *
 * Навигация (стрелки, Home/End, Enter, пробел, Escape) — ВВОД: он принадлежит дереву кита,
 * обрабатывается там и глушится `stopPropagation`, поэтому глобальный слой сочетаний его
 * не видит. Действия (переименовать, удалить, копировать, вставить) — КОМАНДЫ: они объявлены
 * плагином с сочетанием и предикатом «фокус в дереве», и дерево о них не знает ничего.
 * Сочетания с модификатором кит намеренно не перехватывает — иначе `mod+c` не доходил бы
 * до команды копирования.
 *
 * @module host/ui/ResourceTree
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@reformer/ui-kit/tooltip';
import { TREE_ROW_ATTRIBUTE, Tree, type TreeNode } from '@reformer/ui-kit/tree';
import type { ResourceId, ResourceRef } from '@/shell/platform/primitives/resource';
import { NEUTRAL_WHEN_CONTEXT, type WhenContext } from '@/shell/platform/primitives/when-context';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import {
  ResourceDecorationPoint,
  decorationTooltip,
  mergeDecorations,
  observeDecorations,
  type DecorationEntry,
  type DecorationTone,
  type MergedDecoration,
} from '@/shell/platform/ui/contributions/decorations';
import type { CommandRegistry } from '@/shell/platform/primitives/command';
import {
  createLazyEditorProbe,
  createUnreadableProbe,
  type ReadResourceText,
} from '@/shell/platform/ui/contributions/editors';
import { detectPlatformModifier, formatChord } from '@/shell/platform/ui/keyboard/keybindings';
import {
  buildMenu,
  MenuPoint,
  type MenuActionNode,
  type MenuNode,
} from '@/shell/platform/ui/menu/menu';
import { RESOURCE_CONTEXT_MENU, resourceMenuTarget } from '@/shell/platform/ui/menu/resource-menu';
import {
  actionTargets,
  flattenTree,
  levelStatus,
  type ResourceTreeState,
  type ResourceTreeStore,
} from './resource-tree';
import {
  useContributions,
  useLocale,
  type ExtensionReader,
} from '@/shell/platform/ui/chrome/usePanels';
import { useResourceTree } from '@/shell/platform/ui/chrome/useWorkspaceViews';

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

/**
 * Снимок хранилища → узлы дерева кита; попутно собирает адреса обратно в ссылки.
 *
 * Ссылка нужна декорациям и меню целиком (путь, тип, источник), а узел кита несёт только то,
 * что дерево рисует. Возвращать её через узел значило бы протаскивать предметный тип сквозь
 * общий компонент — дешевле и честнее оставить рядом карту.
 *
 * Нечитанный уровень детей НЕ получает: `undefined` в поле `children` для кита означает
 * «уровень не прочитан», а пустой массив — «детей нет». Разница видна человеку: у первого
 * треугольник раскрывается, у второго нет.
 */
function toTreeNodes(
  state: ResourceTreeState,
  parentId: ResourceId,
  refs: Map<ResourceId, ResourceRef>
): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const ref of state.children.get(parentId) ?? []) {
    refs.set(ref.id, ref);
    const directory = ref.kind === 'directory';
    const status = levelStatus(state, ref.id);
    nodes.push({
      id: ref.id,
      label: ref.name,
      kind: directory ? 'branch' : 'leaf',
      title: ref.path,
      ...(directory && state.children.has(ref.id)
        ? { children: toTreeNodes(state, ref.id, refs) }
        : {}),
      ...(status === 'loading' ? { loading: true } : {}),
      ...(status === 'failed' ? { failed: true } : {}),
    });
  }
  return nodes;
}

/**
 * Реестр команд в объёме, нужном контекстному меню: прочитать, спросить применимость,
 * выполнить. `Pick` от настоящего реестра — форма обязана совпадать буква в букву, иначе
 * расхождение вскроется на композиции, а не на типах.
 */
export type TreeCommands = Pick<CommandRegistry, 'get' | 'isEnabled' | 'execute'>;

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

  const { nodes, refs } = useMemo(() => {
    const collected = new Map<ResourceId, ResourceRef>();
    return { nodes: toTreeNodes(state, state.rootId, collected), refs: collected };
  }, [state]);

  const expandedIds = useMemo(() => [...state.expanded], [state.expanded]);
  const checkedIds = useMemo(() => [...state.checked], [state.checked]);

  /**
   * Раскрытие возвращается в хранилище различием, а не заменой набора: только оно знает,
   * что раскрытие ещё не прочитанного каталога стоит одного листинга. Разница между
   * снимками — ровно один адрес, поэтому цикл здесь дешевле любого хитрого протокола.
   */
  const onExpandedChange = useCallback(
    (ids: string[]): void => {
      const next = new Set(ids);
      for (const id of next) if (!state.expanded.has(id)) void tree.expand(id);
      for (const id of state.expanded) if (!next.has(id)) tree.collapse(id);
    },
    [tree, state.expanded]
  );

  const decorate = useCallback(
    (id: ResourceId): MergedDecoration | null => {
      const ref = refs.get(id);
      if (ref === undefined) return null;
      return mergeDecorations(
        decorations,
        ref,
        readText === undefined
          ? createUnreadableProbe(ref)
          : createLazyEditorProbe(() => readText(ref.id))
      );
    },
    [decorations, readText, refs]
  );

  /** Значок вклада бьёт умолчание: «это схема формы» знает вклад, а не дерево. */
  const renderIcon = useCallback(
    (node: TreeNode): ReactElement | null => {
      const Icon = decorate(node.id)?.icon;
      return Icon === undefined ? null : <Icon />;
    },
    [decorate]
  );

  const renderActions = useCallback(
    (node: TreeNode): ReactElement | null => {
      const decoration = decorate(node.id);
      if (decoration?.badge === undefined) return null;
      const badge = (
        <Badge
          variant={BADGE_VARIANT[decoration.tone ?? 'default']}
          className="h-4 px-1.5 py-0 text-[10px]"
        >
          {decoration.badge}
        </Badge>
      );
      const tooltip = decorationTooltip(i18n, decoration);
      if (tooltip === null) return badge;
      return (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      );
    },
    [decorate, i18n]
  );

  /**
   * Запуск строки. Каталог сюда не приходит вовсе: его раскрывает само дерево, потому что
   * открывать каталог нечем. Как в VSCode: одиночный щелчок открывает файл временной вкладкой
   * (следующий такой щелчок займёт её слот), двойной — закрепляет её за файлом.
   */
  const onActivate = useCallback(
    (node: TreeNode, choice: { readonly preview: boolean }): void => {
      onOpen?.(node.id, { preview: choice.preview });
    },
    [onOpen]
  );

  const rows = useMemo(() => flattenTree(state), [state]);

  /**
   * Строка, по которой открыли меню. `null` — щёлкнули мимо строк, и это законный случай.
   *
   * Состоянием, а не вычислением при отрисовке: Radix монтирует содержимое меню отдельно
   * от того щелчка, который его открыл.
   */
  const [menuRow, setMenuRow] = useState<ResourceRef | null>(null);

  const onContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      const element = (event.target as HTMLElement).closest<HTMLElement>(`[${TREE_ROW_ATTRIBUTE}]`);
      const id = element?.getAttribute(TREE_ROW_ATTRIBUTE) ?? null;
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

  const modifier = useMemo(() => detectPlatformModifier(), []);

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
          {/* Гашение подписывается здесь, а не в ките: у `ContextMenuItem` правила
              `data-[disabled]` есть, у `SubTrigger` их нет, и серый заголовок выглядел бы
              обычным. Править пакет ради двух классов — менять общий кит под один вызов. */}
          <ContextMenuSubTrigger
            disabled={!node.enabled}
            className="data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            {node.title}
          </ContextMenuSubTrigger>
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
    <Tree
      className="h-full"
      nodes={nodes}
      expandedIds={expandedIds}
      onExpandedChange={onExpandedChange}
      selectedId={state.selectedId}
      onSelectedChange={tree.select}
      selectionMode="multiple"
      checkedIds={checkedIds}
      onCheckedChange={tree.check}
      onActivate={onActivate}
      renderIcon={renderIcon}
      renderActions={renderActions}
      aria-label={t('shell.tree.label')}
      emptyText={t('shell.tree.empty')}
    />
  );

  // Зона фокуса объявляется ОБЁРТКОЙ, а не деревом: `probeFromElement` поднимается по
  // `closest`, поэтому строке достаточно быть потомком. Кит про предикаты команд не знает
  // и знать не должен.
  //
  // Правый щелчок слушает та же обёртка: она занимает всю панель, тогда как ряд строк —
  // только свою высоту. Без этого щелчок ниже последней строки не сбрасывал бы `menuRow`,
  // и меню показывало бы пункты для строки, которой под курсором нет.
  const zone = (
    <div className="h-full" data-focus-zone="tree" onContextMenu={onContextMenu}>
      {body}
    </div>
  );

  // Без реестра команд меню не существует, и обёртка вокруг дерева не нужна: пустой корень
  // Radix ловил бы правый щелчок и показывал пустую рамку.
  if (commands === undefined) {
    return <TooltipProvider>{zone}</TooltipProvider>;
  }

  return (
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>{zone}</ContextMenuTrigger>
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
