/**
 * Уровень таблицы над моделью: сортировка, фильтры, страницы, видимость колонок и выбор строк —
 * сигналами. Строками владеет модель (клиентский режим) или провайдер (серверный); таблица
 * владеет только состоянием вида.
 *
 * @module table/create-table
 */

import { batch, computed, signal, type ReadonlySignal, type Signal } from '@preact/signals-core';
import { isSignal } from '../signals';
import { watchField } from '../model/behaviors-value';
import { isModelArraySignal } from '../model/model-signals-proxy';
import { modelOf } from '../model/model-value-proxy';
import { rowKeyOf } from '../model/row-key';
import { createStore } from '../model/scope';
import { resource } from '../resource/resource';
import type { AsyncStatus } from '../resource/machine';
import { defaultCompare, defaultMatch, isEmptyFilter, nextDirection, withSort } from './pipeline';
import type {
  ClientTableOptions,
  ColumnDef,
  RowKey,
  RowModel,
  ServerTableOptions,
  SortDirection,
  SortEntry,
  Table,
  TableColumnFace,
  TableFilters,
  TableOptions,
  TableQuery,
  TableRow,
  TableSelection,
} from './types';

/** Строка до лица: ключ, значение и под-модель. */
interface Entry<Row> {
  readonly key: RowKey;
  readonly value: Row;
  readonly model: RowModel<Row> | undefined;
}

/** Откуда таблица берёт строки. */
interface Source<Row> {
  /** Все строки (клиентский режим — до фильтра; серверный — страница). Для согласования выбора. */
  readonly all: ReadonlySignal<readonly Entry<Row>[]>;
  /** Строки текущей страницы. */
  readonly page: ReadonlySignal<readonly Entry<Row>[]>;
  readonly total: ReadonlySignal<number>;
  readonly status: ReadonlySignal<AsyncStatus>;
  readonly refreshing: ReadonlySignal<boolean>;
  readonly error: ReadonlySignal<unknown>;
  /** Число строк известно: можно ограничивать номер страницы сверху. */
  readonly settled: ReadonlySignal<boolean>;
  reload(): void;
}

/** Состояние вида: свои сигналы или привязанные поля модели. */
interface ViewState {
  readonly sorting: Signal<readonly SortEntry[]>;
  readonly filters: Signal<TableFilters>;
  readonly pageIndex: Signal<number>;
  readonly pageSize: Signal<number>;
  readonly selected: Signal<ReadonlySet<RowKey>>;
  readonly hidden: Signal<ReadonlySet<string>>;
}

const EMPTY_KEYS: ReadonlySet<RowKey> = Object.freeze(new Set<RowKey>());

/**
 * Создать уровень таблицы.
 *
 * Режим задаёт конфиг: `data` — клиентский (фильтр → сортировка → страница на `computed` над
 * строками; массив модели даёт строкам под-модель и стабильный ключ), `dataProvider` — серверный
 * (запрос страницы на каждую смену состояния; устаревший запрос отменяется).
 *
 * Команды держат инварианты сами: новый фильтр и новый размер страницы возвращают на первую
 * страницу в той же записи, поэтому одно действие даёт один запрос. Те же правила следят и за
 * внешними записями в привязанные поля (`state`): фильтр сменился — первая страница; строк
 * стало меньше — номер страницы не дальше последней; строки пропали — их ключи уходят из выбора.
 *
 * Таблица принадлежит текущей области (`createStore`) и снимается вместе с ней.
 *
 * @param options - См. {@link TableOptions}.
 * @returns Уровень таблицы.
 *
 * @example Клиентская таблица над массивом модели
 * ```typescript
 * import { arrayOf, createModel, createStore } from '@reformer/core/model';
 * import { createTable } from '@reformer/core/table';
 *
 * const page = createStore(() => {
 *   const model = createModel({ users: arrayOf(() => ({ id: 0, name: '', role: 'user' })) });
 *   const users = createTable({
 *     data: model.$.users,
 *     columns: [
 *       { id: 'name', sortable: true, filterable: true },
 *       { id: 'role', sortable: true },
 *     ],
 *     getRowKey: (u) => u.id,
 *     selection: 'multiple',
 *   });
 *   return { model, users };
 * });
 *
 * page.users.columns.name.toggleSort(); // по имени, по возрастанию
 * page.users.columns.name.setFilter('ив'); // и на первую страницу
 * page.users.rows.value; // строки страницы
 * ```
 *
 * @example Серверная таблица
 * ```typescript
 * const orders = createTable({
 *   dataProvider: (query, { signal }) =>
 *     fetch(`/api/orders?${toSearchParams(query)}`, { signal }).then((r) => r.json()),
 *   columns: [{ id: 'number', sortable: true }, { id: 'customer', filterable: true }],
 *   getRowKey: (order: Order) => order.id,
 * });
 * ```
 *
 * @group Table
 */
export function createTable<Row, const Id extends string = string>(
  options: TableOptions<Row, Id>
): Table<Row, Id> {
  const table = createStore(() => {
    const columns = options.columns;
    const byId = new Map<string, ColumnDef<Row, Id>>(columns.map((c) => [c.id, c]));
    const selectionMode = options.selection ?? 'none';
    const multiSort = options.multiSort ?? true;
    const state = createViewState(options);
    const server = 'dataProvider' in options;

    const query = computed<TableQuery>(() => ({
      filters: state.filters.value,
      pagination: { pageIndex: state.pageIndex.value, pageSize: state.pageSize.value },
      sorting: state.sorting.value.map((entry) => ({ id: entry.id, desc: entry.desc })),
    }));

    const source: Source<Row> = server
      ? serverSource(options as ServerTableOptions<Row, Id>, query)
      : clientSource(options as ClientTableOptions<Row, Id>, state, byId);

    const pageCount = computed(() =>
      Math.max(1, Math.ceil(source.total.value / Math.max(1, state.pageSize.value)))
    );

    // ── Правила: внешние записи в привязанные поля ─────────────────────────────────────────
    // Каждое правило читает один сигнал и пишет другой, поэтому пишет сразу, в том же проходе
    // эффектов: смена ключа загрузки и поправка страницы дают один запрос.
    // R1. Сменились фильтры — первая страница.
    watchField(state.filters, () => {
      if (state.pageIndex.peek() !== 0) state.pageIndex.value = 0;
    });
    // R2. Строк стало меньше — номер страницы не дальше последней. Серверный режим — после ответа:
    // до него число строк неизвестно, и страница из адреса обрезалась бы до первой.
    const lastPage = computed(() => (source.settled.value ? pageCount.value - 1 : Infinity));
    watchField(
      lastPage,
      (last) => {
        if (state.pageIndex.peek() > last) state.pageIndex.value = last;
      },
      { immediate: true }
    );
    // R3. Строки пропали — их ключи уходят из выбора. Без стабильного ключа серверного режима
    // ключ — индекс на странице: в новых строках он указывает на другую строку, выбор сбрасывается.
    watchField(source.all, (entries) => {
      const selected = state.selected.peek();
      if (selected.size === 0) return;
      if (server && !options.getRowKey) {
        state.selected.value = EMPTY_KEYS;
        return;
      }
      if (server) return;
      const alive = new Set(entries.map((entry) => entry.key));
      const kept = [...selected].filter((key) => alive.has(key));
      if (kept.length !== selected.size) state.selected.value = new Set(kept);
    });

    // ── Колонки ─────────────────────────────────────────────────────────────────────────────
    const faces = {} as { [K in Id]: TableColumnFace<K> };
    for (const column of columns) {
      (faces as Record<string, TableColumnFace>)[column.id] = columnFace(column, state, multiSort);
    }
    Object.freeze(faces);
    const visibleColumns = computed(() =>
      columns.filter((column) => !state.hidden.value.has(column.id)).map((column) => column.id)
    );

    // ── Выбор и строки ──────────────────────────────────────────────────────────────────────
    /** Значения выбранных строк в момент выбора: строка с другой страницы в `page` уже не лежит. */
    const remembered = new Map<RowKey, Row>();
    const rowFaces = new Map<RowKey, TableRow<Row>>();

    const write = (next: ReadonlySet<RowKey>): void => {
      for (const key of [...remembered.keys()]) if (!next.has(key)) remembered.delete(key);
      state.selected.value = next;
    };
    const select = (entry: Entry<Row>, on: boolean): void => {
      if (selectionMode === 'none') return;
      const current = state.selected.peek();
      if (
        current.has(entry.key) === on &&
        (selectionMode === 'multiple' || !on || current.size === 1)
      )
        return;
      remembered.set(entry.key, entry.value);
      if (selectionMode === 'single') {
        write(on ? new Set([entry.key]) : EMPTY_KEYS);
        return;
      }
      const next = new Set(current);
      if (on) next.add(entry.key);
      else next.delete(entry.key);
      write(next);
    };

    const rows = computed(() => {
      const page = source.page.value;
      const next = page.map((entry) => {
        const cached = rowFaces.get(entry.key);
        if (cached && cached.value === entry.value && cached.model === entry.model) return cached;
        const face = rowFace(entry, state.selected, select);
        rowFaces.set(entry.key, face);
        return face;
      });
      // Кэш — только строки этой страницы: лица ушедших строк не держим.
      const onPage = new Set(page.map((entry) => entry.key));
      for (const key of [...rowFaces.keys()]) if (!onPage.has(key)) rowFaces.delete(key);
      return next;
    });

    const pageKeys = computed(() => rows.value.map((row) => row.key));
    const selection: TableSelection<Row> = {
      mode: selectionMode,
      keys: state.selected,
      rows: computed(() => {
        const known = new Map<RowKey, Row>();
        for (const entry of source.all.value) known.set(entry.key, entry.value);
        const result: Row[] = [];
        for (const key of state.selected.value) {
          if (known.has(key)) result.push(known.get(key)!);
          else if (remembered.has(key)) result.push(remembered.get(key)!);
        }
        return result;
      }),
      allOnPage: computed(() => {
        const keys = pageKeys.value;
        const selected = state.selected.value;
        return keys.length > 0 && keys.every((key) => selected.has(key));
      }),
      someOnPage: computed(() => {
        const keys = pageKeys.value;
        const selected = state.selected.value;
        const count = keys.filter((key) => selected.has(key)).length;
        return count > 0 && count < keys.length;
      }),
      toggleAllOnPage(): void {
        if (selectionMode !== 'multiple') return;
        const page = rows.peek();
        if (page.length === 0) return;
        const selected = state.selected.peek();
        const all = page.every((row) => selected.has(row.key));
        const next = new Set(selected);
        for (const row of page) {
          if (all) next.delete(row.key);
          else {
            next.add(row.key);
            remembered.set(row.key, row.value);
          }
        }
        write(next);
      },
      clear(): void {
        if (state.selected.peek().size > 0) write(EMPTY_KEYS);
      },
    };

    const setPage = (index: number): void => {
      const last = lastPage.peek();
      state.pageIndex.value = Math.max(0, Math.min(Math.trunc(index), last));
    };

    return {
      mode: (server ? 'server' : 'client') as 'client' | 'server',
      columns: faces,
      visibleColumns,
      rows,
      row: (key: RowKey) => rows.peek().find((row) => row.key === key),
      sorting: state.sorting,
      filters: state.filters,
      pageIndex: state.pageIndex,
      pageSize: state.pageSize,
      pageCount,
      total: source.total,
      query,
      status: source.status,
      refreshing: source.refreshing,
      error: source.error,
      selection,
      setPage,
      nextPage(): void {
        if (state.pageIndex.peek() < lastPage.peek()) state.pageIndex.value += 1;
      },
      prevPage(): void {
        if (state.pageIndex.peek() > 0) state.pageIndex.value -= 1;
      },
      setPageSize(size: number): void {
        batch(() => {
          state.pageSize.value = Math.max(1, Math.trunc(size));
          state.pageIndex.value = 0;
        });
      },
      setSorting(sorting: readonly SortEntry[]): void {
        state.sorting.value = sorting.map((entry) => ({ id: entry.id, desc: entry.desc }));
      },
      clearFilters(): void {
        batch(() => {
          if (Object.keys(state.filters.peek()).length > 0) state.filters.value = {};
          state.pageIndex.value = 0;
        });
      },
      reload: () => source.reload(),
    };
  });
  return table;
}

/** Состояние вида: привязанные поля из `state` или свои сигналы с начальными значениями. */
function createViewState<Row, Id extends string>(options: TableOptions<Row, Id>): ViewState {
  const bound = options.state ?? {};
  const initialFilters: TableFilters = {};
  for (const column of options.columns) {
    if (!isEmptyFilter(column.initialFilter)) initialFilters[column.id] = column.initialFilter;
  }
  const initialHidden = new Set(
    options.columns.filter((column) => column.visible === false).map((column) => column.id)
  );
  return {
    sorting: bound.sorting ?? signal<readonly SortEntry[]>([]),
    filters: bound.filters ?? signal<TableFilters>(initialFilters),
    pageIndex: bound.pageIndex ?? signal(0),
    pageSize: bound.pageSize ?? signal(options.pageSize ?? 10),
    selected: bound.selected ?? signal<ReadonlySet<RowKey>>(EMPTY_KEYS),
    hidden: bound.hidden ?? signal<ReadonlySet<string>>(initialHidden),
  };
}

/** Лицо колонки: сигналы её состояния и команды. */
function columnFace<Row, Id extends string>(
  column: ColumnDef<Row, Id>,
  state: ViewState,
  multiSort: boolean
): TableColumnFace<Id> {
  const { id } = column;
  const sortable = column.sortable ?? false;
  const filterable = column.filterable ?? false;
  const sortIndex = computed(() => state.sorting.value.findIndex((entry) => entry.id === id));
  const sort = computed<SortDirection | null>(() => {
    const entry = state.sorting.value[sortIndex.value];
    return entry === undefined ? null : entry.desc ? 'desc' : 'asc';
  });
  const setSort = (direction: SortDirection | null, options?: { multi?: boolean }): void => {
    if (!sortable) return;
    state.sorting.value = withSort(
      state.sorting.peek(),
      id,
      direction,
      multiSort && (options?.multi ?? false)
    );
  };
  const setFilter = (value: unknown): void => {
    if (!filterable) return;
    const current = state.filters.peek();
    const empty = isEmptyFilter(value);
    if (empty ? !(id in current) : Object.is(current[id], value)) return;
    const next: TableFilters = { ...current };
    if (empty) delete next[id];
    else next[id] = value;
    batch(() => {
      state.filters.value = next;
      state.pageIndex.value = 0;
    });
  };
  return Object.freeze({
    id,
    sortable,
    filterable,
    meta: column.meta,
    sort,
    sortIndex,
    filter: computed(() => state.filters.value[id]),
    visible: computed(() => !state.hidden.value.has(id)),
    toggleSort(options?: { multi?: boolean }): void {
      setSort(nextDirection(sort.peek()), options);
    },
    setSort,
    setFilter,
    clearFilter: () => setFilter(undefined),
    setVisible(visible: boolean): void {
      const hidden = state.hidden.peek();
      if (hidden.has(id) !== visible) return;
      const next = new Set(hidden);
      if (visible) next.delete(id);
      else next.add(id);
      state.hidden.value = next;
    },
  });
}

/** Лицо строки. */
function rowFace<Row>(
  entry: Entry<Row>,
  selected: ReadonlySignal<ReadonlySet<RowKey>>,
  select: (entry: Entry<Row>, on: boolean) => void
): TableRow<Row> {
  const isSelected = computed(() => selected.value.has(entry.key));
  return Object.freeze({
    key: entry.key,
    value: entry.value,
    model: entry.model,
    selected: isSelected,
    select: (on = true) => select(entry, on),
    toggle: () => select(entry, !isSelected.peek()),
  });
}

/** Клиентский режим: фильтр → сортировка → страница на `computed`. */
function clientSource<Row, Id extends string>(
  options: ClientTableOptions<Row, Id>,
  state: ViewState,
  byId: ReadonlyMap<string, ColumnDef<Row, Id>>
): Source<Row> {
  const { data, getRowKey } = options;
  const keyOf = (value: Row, index: number, model: object | undefined): RowKey =>
    String(getRowKey ? getRowKey(value) : model !== undefined ? rowKeyOf(model) : index);

  const entries = computed<readonly Entry<Row>[]>(() => {
    if (isModelArraySignal(data)) {
      const values = (data as ReadonlySignal<readonly Row[]>).value;
      const facade = modelOf(data as unknown as { peek(): Row[] }) as unknown as {
        at(index: number): unknown;
      };
      return values.map((value, index) => {
        const row = facade.at(index);
        const model = row !== null && typeof row === 'object' ? (row as RowModel<Row>) : undefined;
        return { key: keyOf(value, index, model), value, model };
      });
    }
    const values = isSignal(data) ? (data as ReadonlySignal<readonly Row[]>).value : data;
    return (values as readonly Row[]).map((value, index) => ({
      key: keyOf(value, index, undefined),
      value,
      model: undefined,
    }));
  });

  const read = (column: ColumnDef<Row, Id>, row: Row): unknown =>
    column.value ? column.value(row) : (row as Record<string, unknown>)?.[column.id];

  const filtered = computed(() => {
    const active = Object.entries(state.filters.value).filter(([id]) => byId.has(id));
    if (active.length === 0) return entries.value;
    return entries.value.filter((entry) =>
      active.every(([id, filter]) => {
        const column = byId.get(id)!;
        return (column.match ?? defaultMatch)(read(column, entry.value), filter);
      })
    );
  });

  const collator = computed(() => new Intl.Collator(options.locale?.(), { numeric: true }));

  const sorted = computed(() => {
    const sorting = state.sorting.value.filter((entry) => byId.has(entry.id));
    if (sorting.length === 0) return filtered.value;
    const by = collator.value;
    return [...filtered.value].sort((a, b) => {
      for (const { id, desc } of sorting) {
        const column = byId.get(id)!;
        const order = (column.compare ?? defaultCompare)(
          read(column, a.value),
          read(column, b.value),
          by
        );
        if (order !== 0) return desc ? -order : order;
      }
      return 0;
    });
  });

  const page = computed(() => {
    const size = Math.max(1, state.pageSize.value);
    const start = state.pageIndex.value * size;
    return sorted.value.slice(start, start + size);
  });

  return {
    all: entries,
    page,
    total: computed(() => filtered.value.length),
    status: signal<AsyncStatus>('ready'),
    refreshing: signal(false),
    error: signal<unknown>(null),
    settled: signal(true),
    reload: () => {},
  };
}

/** Серверный режим: страница — ответ провайдера на запрос; поверх `resource()`. */
function serverSource<Row, Id extends string>(
  options: ServerTableOptions<Row, Id>,
  query: ReadonlySignal<TableQuery>
): Source<Row> {
  const { getRowKey } = options;
  const page = resource<{ rows: Row[]; total: number }, TableQuery>({
    key: () => query.value,
    load: (q, { signal: abort }) => options.dataProvider(q, { signal: abort }),
    enabled: options.enabled,
    keepPrevious: true, // перезагрузка не размонтирует таблицу: фокус не улетает
  });
  const entries = computed<readonly Entry<Row>[]>(() =>
    (page.data.value?.rows ?? []).map((value, index) => ({
      key: String(getRowKey ? getRowKey(value) : index),
      value,
      model: undefined,
    }))
  );
  return {
    all: entries,
    page: entries,
    total: computed(() => page.data.value?.total ?? 0),
    status: page.status,
    refreshing: page.refreshing,
    error: page.error,
    settled: computed(() => page.status.value === 'ready' && !page.refreshing.value),
    reload: () => page.reload(),
  };
}
