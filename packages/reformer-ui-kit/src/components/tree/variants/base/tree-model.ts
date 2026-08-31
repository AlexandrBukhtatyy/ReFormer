/**
 * Дерево: данные и правила. Здесь нет ни одного React-узла — только структуры и чистые
 * функции над ними, поэтому порядок строк, видимость и поиск проверяются в `node` без DOM.
 *
 * ## Плоский ряд строк вместо рекурсии в отрисовке
 *
 * {@link flattenTree} разворачивает состояние в ряд строк с глубиной: дети раскрытой ветки
 * идут сразу за ней. Так отрисовка остаётся циклом по массиву — то, без чего виртуальный
 * скролл пришлось бы вплетать в рекурсию, — а «какая строка следующая» становится вопросом
 * к индексу, а не к обходу.
 *
 * ## Уровень читается один раз и не забывается
 *
 * Состояние уровня — три значения, а не флаг: «пусто» и «ещё не спрашивали» это разное, и
 * ветка без прочитанного уровня обязана показывать треугольник, хотя детей у неё пока нет.
 * Свёрнутая ветка прочитанных детей НЕ теряет: свернуть и раскрыть обратно — частое движение,
 * и платить за него повторным запросом значило бы наказывать за осмотр дерева.
 *
 * @module components/tree/tree-model
 */

import type * as React from 'react';

/** Ключ корневого уровня. Пустая строка — идентификаторы узлов всегда непусты. */
export const ROOT_KEY = '';

/** Состояние загрузки уровня. */
export type TreeLevelStatus = 'unloaded' | 'loading' | 'loaded' | 'failed';

/** Вид узла: ветка раскрывается, лист — нет. */
export type TreeNodeKind = 'branch' | 'leaf';

/** Оформление метки строки — те же тона, что у {@link Badge}. */
export type TreeBadgeTone = 'default' | 'secondary' | 'destructive' | 'outline';

/**
 * Узел дерева.
 *
 * `kind` объявляется, а не выводится из `children`: у ленивой ветки детей ещё нет, и пустой
 * каталог был бы неотличим от файла. Умолчание — `'branch'`, если поле `children` присутствует,
 * иначе `'leaf'`.
 */
export interface TreeNode {
  /** Адрес узла, уникальный в пределах всего дерева: по нему идут раскрытие, выбор и фокус. */
  id: string;
  /** Видимая подпись строки. По ней же идёт поиск. */
  label: string;
  /** Ветка или лист. */
  kind?: TreeNodeKind;
  /** Дети. У ветки `undefined` означает «уровень не прочитан», а не «детей нет». */
  children?: readonly TreeNode[];
  /** Метка справа от подписи. */
  badge?: string;
  /** Тон метки. */
  badgeTone?: TreeBadgeTone;
  /** Подсказка при наведении. По умолчанию — `label`. */
  title?: string;
  /** Строку нельзя выбрать. Раскрыть ветку по-прежнему можно: это осмотр, а не выбор. */
  disabled?: boolean;
  /**
   * Уровень читается прямо сейчас — вместо треугольника показывается спиннер.
   *
   * Объявляется узлом, а не только выводится из внутреннего чтения, ради потребителей,
   * у которых загрузка уровней уже своя: дерево с чужим хранилищем обязано уметь показать
   * его состояние, не отбирая у него это хранилище.
   */
  loading?: boolean;
  /** Уровень не прочитался: нет прав, каталог исчез. Подпись становится тревожной. */
  failed?: boolean;
}

/** Строка видимого ряда — то, что дерево отрисовывает. */
export interface TreeRow {
  readonly node: TreeNode;
  /** Глубина от корня; узлы верхнего уровня — `0`. */
  readonly depth: number;
  /** Раскрыта ли ветка. У листа всегда `false`. */
  readonly expanded: boolean;
  /** Уровень читается прямо сейчас. */
  readonly loading: boolean;
  /** Уровень не прочитался: нет прав, каталог исчез. */
  readonly failed: boolean;
  readonly selected: boolean;
  /** Входит ли строка в отмеченный набор. */
  readonly checked: boolean;
  /** Ветка ли это — считано один раз, чтобы отрисовка не повторяла правило. */
  readonly branch: boolean;
  /**
   * Строку нельзя выбрать: так объявлено узлом либо так решил предикат дерева. Считается
   * здесь, а не в отрисовке, потому что тот же ответ нужен клавиатуре и правилам выбора —
   * а два места, отвечающие на один вопрос, рано или поздно отвечают по-разному.
   */
  readonly disabled: boolean;
  /** Адрес родителя; у верхнего уровня — `null`. Нужен стрелке «влево». */
  readonly parentId: string | null;
}

/** Ветка ли узел. Правило одно на всё дерево — и на отрисовку, и на клавиатуру. */
export function isBranch(node: TreeNode): boolean {
  return (node.kind ?? (node.children === undefined ? 'leaf' : 'branch')) === 'branch';
}

/**
 * Снимок дерева. Ссылки на коллекции меняются только вместе с содержимым — на этом стоит
 * дешёвое сравнение в `useMemo` отрисовки.
 */
export interface TreeState {
  /** Прочитанные уровни: адрес ветки (или {@link ROOT_KEY}) → её дети в порядке показа. */
  readonly children: ReadonlyMap<string, readonly TreeNode[]>;
  readonly status: ReadonlyMap<string, TreeLevelStatus>;
  readonly expanded: ReadonlySet<string>;
}

/** Пустое состояние: ничего не прочитано и ничего не раскрыто. */
export function createTreeState(expanded: Iterable<string> = []): TreeState {
  return { children: new Map(), status: new Map(), expanded: new Set(expanded) };
}

/** Состояние уровня. Неизвестная ветка — `unloaded`, а не отсутствие ответа. */
export function levelStatus(state: TreeState, id: string): TreeLevelStatus {
  return state.status.get(id) ?? 'unloaded';
}

/** Записывает прочитанный уровень. */
export function setChildren(state: TreeState, id: string, entries: readonly TreeNode[]): TreeState {
  const children = new Map(state.children);
  children.set(id, entries);
  const status = new Map(state.status);
  status.set(id, 'loaded');
  return { ...state, children, status };
}

/** Отмечает состояние уровня, не трогая уже прочитанных детей. */
export function setLevelStatus(state: TreeState, id: string, next: TreeLevelStatus): TreeState {
  if (levelStatus(state, id) === next) return state;
  const status = new Map(state.status);
  status.set(id, next);
  return { ...state, status };
}

/** Забывает прочитанный уровень: ветку придётся перечитать при следующем обращении. */
export function invalidateLevel(state: TreeState, id: string): TreeState {
  if (!state.children.has(id) && !state.status.has(id)) return state;
  const children = new Map(state.children);
  children.delete(id);
  const status = new Map(state.status);
  status.delete(id);
  return { ...state, children, status };
}

/** Помечает ветку раскрытой. Чтение уровня — дело компонента, не этой функции. */
export function expandNode(state: TreeState, id: string): TreeState {
  if (state.expanded.has(id)) return state;
  const expanded = new Set(state.expanded);
  expanded.add(id);
  return { ...state, expanded };
}

/** Сворачивает ветку. Прочитанные дети остаются в состоянии. */
export function collapseNode(state: TreeState, id: string): TreeState {
  if (!state.expanded.has(id)) return state;
  const expanded = new Set(state.expanded);
  expanded.delete(id);
  return { ...state, expanded };
}

/**
 * Дети уровня: сначала прочитанные компонентом, иначе объявленные в самом узле.
 *
 * Порядок важен: перечитанный уровень (`refresh`) обязан вытеснить то, что пришло пропом,
 * иначе удалённый файл остался бы в дереве до следующей перерисовки сверху.
 */
export function childrenOf(
  state: TreeState,
  node: TreeNode | null,
  roots: readonly TreeNode[]
): readonly TreeNode[] | undefined {
  const key = node === null ? ROOT_KEY : node.id;
  const loaded = state.children.get(key);
  if (loaded !== undefined) return loaded;
  return node === null ? roots : node.children;
}

/** Параметры разворачивания состояния в ряд строк. */
export interface FlattenOptions {
  readonly state: TreeState;
  /** Узлы верхнего уровня. */
  readonly roots: readonly TreeNode[];
  readonly selectedId: string | null;
  readonly checked: ReadonlySet<string>;
  /**
   * Ветки, раскрытые ПОИСКОМ, а не человеком. Держатся отдельно от {@link TreeState.expanded},
   * потому что раскрытие по совпадению временно: убрали запрос — ветка обязана вернуться
   * в то состояние, в каком её оставил человек.
   */
  readonly forcedExpanded?: ReadonlySet<string>;
  /** Множество адресов, которые прошли фильтр вместе с предками. `undefined` — фильтра нет. */
  readonly visible?: ReadonlySet<string>;
  /**
   * Дополнительный запрет выбора поверх `node.disabled`. Нужен там, где запрет ДИНАМИЧЕСКИЙ
   * и в данных узла его быть не может: достигнутый потолок числа выбранных, чужая блокировка,
   * права на конкретный файл.
   */
  readonly isDisabled?: (node: TreeNode) => boolean;
}

/**
 * Разворачивает состояние в видимый ряд строк.
 *
 * Обход в глубину: дети раскрытой ветки идут сразу за ней. Нечитанный уровень строк не даёт —
 * их ещё нет, а не «их ноль».
 */
export function flattenTree(options: FlattenOptions): readonly TreeRow[] {
  const { state, roots, selectedId, checked, forcedExpanded, visible, isDisabled } = options;
  const rows: TreeRow[] = [];

  const walk = (parent: TreeNode | null, depth: number): void => {
    for (const node of childrenOf(state, parent, roots) ?? []) {
      if (visible !== undefined && !visible.has(node.id)) continue;

      const branch = isBranch(node);
      const expanded =
        branch && (state.expanded.has(node.id) || (forcedExpanded?.has(node.id) ?? false));
      const status = levelStatus(state, node.id);

      rows.push({
        node,
        depth,
        expanded,
        // Состояние узла и состояние внутреннего чтения складываются, а не спорят: первое
        // приходит от потребителя со своим хранилищем, второе — от `loadChildren`.
        loading: status === 'loading' || node.loading === true,
        failed: status === 'failed' || node.failed === true,
        selected: selectedId === node.id,
        checked: checked.has(node.id),
        branch,
        disabled: node.disabled === true || isDisabled?.(node) === true,
        parentId: parent === null ? null : parent.id,
      });

      if (expanded) walk(node, depth + 1);
    }
  };

  walk(null, 0);
  return rows;
}

/**
 * Адреса строк между двумя, включая обе, — то, что отмечает щелчок с Shift.
 *
 * Считается по ВИДИМЫМ строкам, а не по дереву: человек выделяет то, что видит, и строки
 * свёрнутой ветки в диапазон попадать не должны, хотя в дереве они между ними лежат.
 * Неизвестная граница даёт пустой диапазон — выделять нечего, а не «выделить всё».
 */
export function rangeIds(rows: readonly TreeRow[], from: string, to: string): readonly string[] {
  const start = rows.findIndex((row) => row.node.id === from);
  const end = rows.findIndex((row) => row.node.id === to);
  if (start === -1 || end === -1) return [];
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return rows.slice(lo, hi + 1).map((row) => row.node.id);
}

/**
 * К чему применится действие: набор, если выделение стоит внутри него, иначе одна строка.
 *
 * Без этого правила клавиша и пункт меню отвечали бы на разные вопросы: первая — про строку
 * под выделением, второй — про набор, и человек не знал бы заранее, что именно произойдёт.
 * Порядок — порядок строк дерева, а не порядок отметок: действие сверху вниз предсказуемо,
 * «в том порядке, в каком тыкали» — нет.
 */
export function actionTargets(rows: readonly TreeRow[]): readonly TreeNode[] {
  const selected = rows.find((row) => row.selected);
  if (selected !== undefined && !selected.checked) return [selected.node];
  const checked = rows.filter((row) => row.checked).map((row) => row.node);
  if (checked.length > 0) return checked;
  return selected === undefined ? [] : [selected.node];
}

/** Результат фильтрации: что показывать и что раскрыть, чтобы совпадения были видны. */
export interface FilterResult {
  /** Адреса совпавших узлов и всех их предков. */
  readonly visible: ReadonlySet<string>;
  /** Ветки, которые надо раскрыть, чтобы совпадения стали видны. */
  readonly forcedExpanded: ReadonlySet<string>;
  /** Совпало ли хоть что-нибудь. */
  readonly matched: boolean;
}

/**
 * Отбирает узлы по подстроке в `label` и достраивает до них путь.
 *
 * Ветка остаётся в дереве, если совпала сама ИЛИ если совпал кто-то из её потомков —
 * иначе совпавший файл оказался бы вне дерева и показать его было бы негде.
 *
 * Раскрывается ветка тогда, когда внутри неё есть совпадение: до него надо доводить взглядом.
 * Ветка, совпавшая ТОЛЬКО сама, остаётся в том состоянии, в каком её оставил человек, — но
 * содержимое её при этом видно целиком, если он её раскроет: искали каталог, а не отдельные
 * файлы в нём.
 *
 * Фильтр видит только ПРОЧИТАННЫЕ уровни. Это не упущение: нечитанный уровень нельзя
 * просмотреть, не сходив за ним, а поиск, тихо загружающий весь источник, — не поиск,
 * а обход. Ветку с нечитанным уровнем фильтр оставляет видимой, чтобы её можно было
 * раскрыть руками.
 */
export function filterTree(
  state: TreeState,
  roots: readonly TreeNode[],
  query: string
): FilterResult {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') {
    return { visible: new Set(), forcedExpanded: new Set(), matched: true };
  }

  const visible = new Set<string>();
  const forcedExpanded = new Set<string>();

  /** Совпало ли что-нибудь в поддереве; попутно наполняет `visible` и `forcedExpanded`. */
  const walk = (node: TreeNode | null, ancestors: readonly string[]): boolean => {
    const kids = childrenOf(state, node, roots);
    let hit = false;

    for (const child of kids ?? []) {
      const self = child.label.toLocaleLowerCase().includes(needle);
      const branch = isBranch(child);
      const path = [...ancestors, child.id];

      /**
       * Вглубь ветки идём ВСЕГДА, даже когда она совпала сама.
       *
       * Соблазн срезать здесь («совпала — значит показываем целиком, дальше не смотрим»)
       * даёт молчаливую потерю: каталог `components` совпадает с запросом «ts» своим же
       * хвостом, и при срезе он остаётся свёрнутым — вместе со всеми файлами внутри,
       * которые тоже совпали. Человек видит один свёрнутый каталог там, где ожидал список.
       */
      const deeper = branch ? walk(child, path) : false;
      // Нечитанная ветка остаётся видимой: её содержимое ещё не за что судить.
      const unread = branch && kids !== undefined && childrenOf(state, child, roots) === undefined;

      if (self || deeper || unread) {
        hit = true;
        visible.add(child.id);
        for (const id of ancestors) {
          visible.add(id);
          forcedExpanded.add(id);
        }
        if (deeper) forcedExpanded.add(child.id);
        if (self && branch) markSubtree(state, child, roots, visible);
      }
    }

    return hit;
  };

  const matched = walk(null, []);
  return { visible, forcedExpanded, matched };
}

/** Добавляет всё прочитанное поддерево в набор видимых — для совпавшей ветки. */
function markSubtree(
  state: TreeState,
  node: TreeNode,
  roots: readonly TreeNode[],
  into: Set<string>
): void {
  for (const child of childrenOf(state, node, roots) ?? []) {
    into.add(child.id);
    if (isBranch(child)) markSubtree(state, child, roots, into);
  }
}

/** Состояние строки, которое видят рендер-слоты. */
export interface TreeRenderState {
  readonly branch: boolean;
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly checked: boolean;
}

/**
 * Значок строки. Вынесен из отрисовки, потому что им подменяют умолчание: «это схема формы»
 * знает потребитель, а не дерево.
 */
export type TreeIconRenderer = (node: TreeNode, state: TreeRenderState) => React.ReactNode;
