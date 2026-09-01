/**
 * Дерево ресурсов: правила и хранилище.
 *
 * **Навигация по ресурсам — платформенная.** Она про источник и рабочую область, а не про
 * формы, поэтому дерево живёт в Host целиком. Предметное знание («этот JSON — схема формы»)
 * приходит вкладом-декорацией (см. `./decorations`), и дерево о формах по-прежнему не знает
 * ничего.
 *
 * ## Ленивое раскрытие по уровням
 *
 * Уровень берётся ОДНИМ обращением `list(dir)`. Тела файлов не читаются ни при раскрытии,
 * ни при отрисовке строк: у источника листинг стоит один запрос, а чтение — по запросу
 * на файл, и дерево на пятьсот файлов превратилось бы в пятьсот обращений ради иконок.
 * Прочитанный уровень запоминается: повторное раскрытие свёрнутого каталога обращения
 * не стоит вовсе.
 *
 * ## Плоский список вместо рекурсии в отрисовке
 *
 * {@link flattenTree} разворачивает состояние в ряд строк с глубиной. Так порядок и видимость
 * проверяются без браузера, а отрисовка остаётся циклом по массиву — то, что позже позволит
 * виртуализировать длинный список, не трогая правил.
 *
 * @module host/ui/resource-tree
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import type { ResourceId, ResourceRef } from '@/shell/platform/primitives/resource';
import type { Workspace } from '@/shell/platform/workspace/workspace';

/** Состояние загрузки уровня. Три состояния, потому что «пусто» и «ещё не спрашивали» — разное. */
export type LevelStatus = 'unloaded' | 'loading' | 'loaded' | 'failed';

/** Снимок дерева. Ссылка стабильна между изменениями — условие `useSyncExternalStore`. */
export interface ResourceTreeState {
  /** Каталог, чьи дети показываются верхним уровнем. Сам он в ряд строк не попадает. */
  readonly rootId: ResourceId;
  /** Прочитанные уровни: каталог → его дети в порядке показа. */
  readonly children: ReadonlyMap<ResourceId, readonly ResourceRef[]>;
  readonly status: ReadonlyMap<ResourceId, LevelStatus>;
  readonly expanded: ReadonlySet<ResourceId>;
  /** Выделенная строка. Выделение в дереве — навигация, а не правка, и живёт здесь. */
  readonly selectedId: ResourceId | null;
  /**
   * Отмеченный НАБОР строк — то, к чему применится действие над несколькими записями.
   *
   * Отдельно от `selectedId`, потому что это разные вещи: выделение — «где я сейчас»
   * (одна строка, туда же уходит фокус), набор — «что я выбрал» (сколько угодно строк,
   * и та, где стоит фокус, в него может не входить). Свести их в один список нельзя:
   * тогда «где я» перестаёт иметь ответ, а клавиатурная навигация теряет точку отсчёта
   * для диапазона.
   */
  readonly checked: ReadonlySet<ResourceId>;
}

/** Строка видимого ряда. */
export interface TreeRow {
  readonly ref: ResourceRef;
  /** Глубина от корня; дети корня — `0`. */
  readonly depth: number;
  readonly expanded: boolean;
  /** Идёт ли чтение этого уровня прямо сейчас. */
  readonly loading: boolean;
  /** Уровень не прочитался: нет прав, каталог исчез. */
  readonly failed: boolean;
  readonly selected: boolean;
  /** Входит ли строка в отмеченный набор. */
  readonly checked: boolean;
}

/** Пустое дерево над корнем источника. */
export function createTreeState(rootId: ResourceId): ResourceTreeState {
  return {
    rootId,
    children: new Map(),
    status: new Map(),
    expanded: new Set(),
    selectedId: null,
    checked: new Set(),
  };
}

/** Состояние уровня. Неизвестный каталог — `unloaded`, а не отсутствие ответа. */
export function levelStatus(state: ResourceTreeState, id: ResourceId): LevelStatus {
  return state.status.get(id) ?? 'unloaded';
}

/**
 * Порядок внутри уровня: каталоги выше файлов, дальше — по имени.
 *
 * Числа в именах сравниваются как числа (`form2` перед `form10`): в проекте с формами
 * нумерованные имена — норма, а лексикографический порядок ставил бы десятую перед второй.
 * Регистр не различается — иначе `Schema.json` уезжает от `schema.json` на другой конец
 * уровня в зависимости от того, чем создан файл.
 */
export function sortEntries(entries: readonly ResourceRef[]): readonly ResourceRef[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** Записывает прочитанный уровень; порядок наводится здесь, а не у вызывающего. */
export function setChildren(
  state: ResourceTreeState,
  id: ResourceId,
  entries: readonly ResourceRef[]
): ResourceTreeState {
  const children = new Map(state.children);
  children.set(id, sortEntries(entries));
  const status = new Map(state.status);
  status.set(id, 'loaded');
  return { ...state, children, status };
}

/** Отмечает состояние уровня, не трогая уже прочитанных детей. */
export function setLevelStatus(
  state: ResourceTreeState,
  id: ResourceId,
  next: LevelStatus
): ResourceTreeState {
  if (levelStatus(state, id) === next) return state;
  const status = new Map(state.status);
  status.set(id, next);
  return { ...state, status };
}

/** Забывает прочитанный уровень: каталог придётся перечитать при следующем раскрытии. */
export function invalidateLevel(state: ResourceTreeState, id: ResourceId): ResourceTreeState {
  if (!state.children.has(id) && !state.status.has(id)) return state;
  const children = new Map(state.children);
  children.delete(id);
  const status = new Map(state.status);
  status.delete(id);
  return { ...state, children, status };
}

/** Помечает каталог раскрытым. Чтение уровня — дело хранилища, не этой функции. */
export function expandNode(state: ResourceTreeState, id: ResourceId): ResourceTreeState {
  if (state.expanded.has(id)) return state;
  const expanded = new Set(state.expanded);
  expanded.add(id);
  return { ...state, expanded };
}

/**
 * Сворачивает каталог. Прочитанные дети НЕ забываются: свернуть и раскрыть обратно —
 * частое движение, и платить за него листингом означало бы наказывать за осмотр дерева.
 */
export function collapseNode(state: ResourceTreeState, id: ResourceId): ResourceTreeState {
  if (!state.expanded.has(id)) return state;
  const expanded = new Set(state.expanded);
  expanded.delete(id);
  return { ...state, expanded };
}

/** Выделяет строку. Повторное выделение того же ничего не меняет. */
export function selectNode(state: ResourceTreeState, id: ResourceId | null): ResourceTreeState {
  if (state.selectedId === id) return state;
  return { ...state, selectedId: id };
}

/** Общий пустой набор: одна ссылка на все состояния без отметок. */
const NO_CHECKED: ReadonlySet<ResourceId> = Object.freeze(new Set<ResourceId>());

/** Задаёт отмеченный набор целиком. Пустой список снимает отметки. */
export function setChecked(state: ResourceTreeState, ids: Iterable<ResourceId>): ResourceTreeState {
  const next = new Set(ids);
  if (next.size === 0) {
    return state.checked.size === 0 ? state : { ...state, checked: NO_CHECKED };
  }
  if (next.size === state.checked.size && [...next].every((id) => state.checked.has(id))) {
    return state;
  }
  return { ...state, checked: next };
}

/** Добавляет строку в набор или убирает её оттуда — то, что делает щелчок с Ctrl/Cmd. */
export function toggleChecked(state: ResourceTreeState, id: ResourceId): ResourceTreeState {
  const next = new Set(state.checked);
  if (!next.delete(id)) next.add(id);
  return setChecked(state, next);
}

/**
 * Адреса строк между двумя, включая обе, — то, что отмечает щелчок с Shift.
 *
 * Считается по ВИДИМЫМ строкам, а не по дереву: человек выделяет то, что видит, и строки
 * свёрнутого каталога в диапазон попадать не должны, хотя в дереве они между ними лежат.
 * Неизвестная граница даёт пустой диапазон — выделять нечего, а не «выделить всё».
 */
export function rangeIds(
  rows: readonly TreeRow[],
  from: ResourceId,
  to: ResourceId
): readonly ResourceId[] {
  const start = rows.findIndex((row) => row.ref.id === from);
  const end = rows.findIndex((row) => row.ref.id === to);
  if (start === -1 || end === -1) return [];
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return rows.slice(lo, hi + 1).map((row) => row.ref.id);
}

/**
 * К чему применится действие: набор, если фокус стоит внутри него, иначе одна строка.
 *
 * Это правило v1 («ко всему набору, если кликнули по его строке»), распространённое
 * и на клавиатуру. Без него клавиша `Delete` и пункт меню «Удалить» отвечали бы на разные
 * вопросы: первая — про строку под фокусом, второй — про набор, и человек не мог бы знать
 * заранее, что именно исчезнет.
 *
 * Порядок — порядок строк дерева, а не порядок отметок: удаление и копирование сверху вниз
 * предсказуемо, а «в том порядке, в каком тыкали» — нет.
 */
export function actionTargets(rows: readonly TreeRow[]): readonly ResourceRef[] {
  const selected = rows.find((row) => row.selected);
  if (selected !== undefined && !selected.checked) return [selected.ref];
  const checked = rows.filter((row) => row.checked).map((row) => row.ref);
  if (checked.length > 0) return checked;
  return selected === undefined ? [] : [selected.ref];
}

/**
 * Разворачивает состояние в видимый ряд строк.
 *
 * Обход в глубину от детей корня; дети раскрытого каталога идут сразу за ним. Нечитанный
 * уровень строк не даёт — их ещё нет, а не «их ноль».
 */
export function flattenTree(state: ResourceTreeState): readonly TreeRow[] {
  const rows: TreeRow[] = [];

  const walk = (parentId: ResourceId, depth: number): void => {
    for (const ref of state.children.get(parentId) ?? []) {
      const expanded = state.expanded.has(ref.id);
      const status = levelStatus(state, ref.id);
      rows.push({
        ref,
        depth,
        expanded: ref.kind === 'directory' && expanded,
        loading: status === 'loading',
        failed: status === 'failed',
        selected: state.selectedId === ref.id,
        checked: state.checked.has(ref.id),
      });
      if (ref.kind === 'directory' && expanded) walk(ref.id, depth + 1);
    }
  };

  walk(state.rootId, 0);
  return rows;
}

/**
 * Рабочая область в объёме, нужном дереву: один листинг уровня и ничего больше.
 *
 * Отсутствие `readText` в этом типе — не экономия, а гарантия: дерево физически не может
 * прочитать тело файла, и правило «раскрытие стоит один листинг» держится на типах.
 */
export type TreeWorkspace = Pick<Workspace, 'list'>;

export interface ResourceTreeStoreOptions {
  readonly workspace: TreeWorkspace;
  /** Корень показа: обычно корень источника, `<sourceId>:`. */
  readonly rootId: ResourceId;
  readonly onError?: (error: unknown, id: ResourceId) => void;
}

export interface ResourceTreeStore extends Disposable {
  get(): ResourceTreeState;
  subscribe(listener: () => void): Disposable;
  /** Раскрывает каталог, дочитывая уровень, если он ещё не прочитан. */
  expand(id: ResourceId): Promise<void>;
  collapse(id: ResourceId): void;
  /** Раскрывает или сворачивает — то, что делает клик по треугольнику. */
  toggle(id: ResourceId): Promise<void>;
  select(id: ResourceId | null): void;
  /** Задаёт отмеченный набор целиком: обычный щелчок оставляет в нём одну строку. */
  check(ids: Iterable<ResourceId>): void;
  /** Добавляет строку в набор или убирает её — щелчок с Ctrl/Cmd. */
  toggleCheck(id: ResourceId): void;
  /** Перечитывает уровень: файл создан, удалён, переименован. */
  refresh(id: ResourceId): Promise<void>;
}

function defaultOnTreeError(error: unknown, id: ResourceId): void {
  console.error(`[shell] дерево ресурсов: уровень «${id}» не прочитан`, error);
}

export function createResourceTreeStore(options: ResourceTreeStoreOptions): ResourceTreeStore {
  const { workspace, rootId } = options;
  const onError = options.onError ?? defaultOnTreeError;

  let state = createTreeState(rootId);
  const listeners = new Set<() => void>();
  /** Уровни, чтение которых идёт: второй клик по треугольнику не должен слать второй листинг. */
  const inFlight = new Map<ResourceId, Promise<void>>();

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        onError(error, rootId);
      }
    }
  };

  const commit = (next: ResourceTreeState): void => {
    if (next === state) return;
    state = next;
    notify();
  };

  const load = (id: ResourceId): Promise<void> => {
    const running = inFlight.get(id);
    if (running !== undefined) return running;

    commit(setLevelStatus(state, id, 'loading'));
    const promise = workspace
      .list(id)
      .then((entries) => {
        commit(setChildren(state, id, entries));
      })
      .catch((error: unknown) => {
        // Отказ уровня — состояние строки, а не авария дерева: каталог мог исчезнуть,
        // а остальные уровни при этом читаются.
        onError(error, id);
        commit(setLevelStatus(state, id, 'failed'));
      })
      .finally(() => {
        inFlight.delete(id);
      });

    inFlight.set(id, promise);
    return promise;
  };

  const ensureLevel = (id: ResourceId): Promise<void> => {
    // Прочитанный уровень не перечитывается: это и есть «ленивое раскрытие по уровням».
    if (levelStatus(state, id) === 'loaded') return Promise.resolve();
    return load(id);
  };

  return {
    get: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    async expand(id) {
      commit(expandNode(state, id));
      await ensureLevel(id);
    },

    collapse(id) {
      commit(collapseNode(state, id));
    },

    async toggle(id) {
      if (state.expanded.has(id)) {
        commit(collapseNode(state, id));
        return;
      }
      commit(expandNode(state, id));
      await ensureLevel(id);
    },

    select(id) {
      commit(selectNode(state, id));
    },

    check(ids) {
      commit(setChecked(state, ids));
    },

    toggleCheck(id) {
      commit(toggleChecked(state, id));
    },

    async refresh(id) {
      commit(invalidateLevel(state, id));
      await load(id);
    },

    dispose() {
      listeners.clear();
      inFlight.clear();
    },
  };
}
