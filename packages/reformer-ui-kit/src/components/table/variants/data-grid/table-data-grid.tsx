import { useKitMessages } from '@/i18n/messages';
import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { createStore, watchField } from '@reformer/core/model';
import { useSignalSnapshot, useStore } from '@reformer/core/react';
import { signal } from '@reformer/core/signals';
import {
  createTable,
  type SelectionMode,
  type Table as TableLevel,
  type TableColumnFace,
  type TableFilters,
  type TablePage,
  type TableQuery,
} from '@reformer/core/table';

import { cn } from '@/lib/utils';
import { AsyncBoundary } from '@/components/async-boundary';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../base/table-base';

// DataGrid — вид над уровнем таблицы `@reformer/core/table` поверх презентационного Table
// (variants/base). Не form-control. Состояние (сортировка, фильтры, страницы, выбор, загрузка)
// держит уровень таблицы, вид только рисует его сигналы и вызывает команды. Два режима:
// `settings` — грид сам создаёт серверную таблицу из `dataProvider`; `table` — грид рисует
// готовую таблицу (клиентскую над массивом модели или серверную), созданную в сторе приложения.
// Состояния loading / error / empty — через AsyncBoundary; навигация по страницам — Pagination.

export type { TableFilters, TablePage, TableQuery };

/** Режим выделения строк DataGrid. */
export type TableSelectionMode = SelectionMode;

/** Описание одной колонки DataGrid — отрисовка; состояние колонки держит уровень таблицы. */
export interface TableColumn<Row> {
  /** Уникальный id колонки (ключ; попадает в `sorting[].id` и `filters`). */
  id: string;
  /** Заголовок колонки. */
  header: React.ReactNode;
  /** Извлекатель содержимого ячейки из строки. Если не задан — ячейка пустая. */
  accessor?: (row: Row) => React.ReactNode;
  /**
   * Разрешить сортировку по колонке (кликабельный заголовок). По умолчанию `false`. Режим `table`
   * берёт это из колонки уровня таблицы.
   */
  sortable?: boolean;
  /**
   * Разрешить фильтрацию по колонке (текстовый инпут в тулбаре). По умолчанию `false`. Режим
   * `table` берёт это из колонки уровня таблицы.
   */
  filterable?: boolean;
  /** Плейсхолдер для фильтр-инпута колонки. По умолчанию — `id`. */
  filterPlaceholder?: string;
  /**
   * Подпись фильтр-инпута для скринридера. По умолчанию — `kit.table.filter` с заголовком колонки
   * («Фильтр: Имя»); если `header` не строка — с `id` колонки.
   */
  filterLabel?: string;
  /** Горизонтальное выравнивание содержимого. По умолчанию `left`. */
  align?: 'left' | 'center' | 'right';
  /** Доп. className для ячеек и заголовка колонки. */
  className?: string;
}

/** Выбранные строки DataGrid — аргумент `onSelectionChange`. */
export interface TableSelection<Row> {
  /** Ключи выбранных строк: `String(rowKey(row))`, без `rowKey` — индекс строки на странице. */
  keys: string[];
  /** Сами выбранные строки (в том числе выбранные на других страницах — при заданном `rowKey`). */
  rows: Row[];
}

/** Контракт настроек DataGrid (режим `settings`). */
export interface TableSettings<Row> {
  /**
   * Провайдер данных. Вызывается при монтировании и при любом изменении
   * pagination / sorting / filters — одно действие, один вызов. Должен вернуть строки текущей
   * страницы и общее число строк. Отклонение промиса → состояние ошибки с кнопкой «Повторить».
   * `signal` отменяется, когда запрос устарел (новая страница, фильтр, размонтирование).
   */
  dataProvider: (query: TableQuery, ctx: { signal: AbortSignal }) => Promise<TablePage<Row>>;
  /**
   * Колонки таблицы. Смена состава (id, сортируемость, фильтруемость) пересоздаёт таблицу:
   * состояние сортировки, фильтров и выбора начинается заново.
   */
  columns: TableColumn<Row>[];
  /**
   * Размер страницы. По умолчанию `10`. Смена значения перезапрашивает данные с первой страницы.
   */
  pageSize?: number;
  /**
   * Стабильный ключ строки (для React-key и выделения). По умолчанию — индекс на странице: тогда
   * выделение сбрасывается при каждой смене строк (страница, фильтр, сортировка, перезагрузка) —
   * индекс уже указывает на другую строку. С `rowKey` выделение переживает перелистывание.
   */
  rowKey?: (row: Row) => string | number;
  /** Режим выделения строк. По умолчанию `none`. */
  selection?: TableSelectionMode;
  /**
   * Вызывается после каждого изменения выделения (в том числе сброса) — так выбранные строки
   * читаются снаружи, например для массового действия.
   */
  onSelectionChange?: (selection: TableSelection<Row>) => void;
}

/** Props {@link DataGrid}: настройки серверной таблицы или готовая таблица уровня. */
export type DataGridProps<Row> =
  | {
      /** Настройки грида (data-provider, колонки, пагинация, выделение). */
      settings: TableSettings<Row>;
      /** Доп. className контейнера. */
      className?: string;
    }
  | {
      /** Таблица уровня (`createTable` из `@reformer/core/table`) — её создаёт стор приложения. */
      table: TableLevel<Row, string>;
      /** Отрисовка колонок по id. Колонка без пары в таблице рисуется как есть (действия). */
      columns: TableColumn<Row>[];
      /** Изменение выделения. Режим выделения задаёт таблица. */
      onSelectionChange?: (selection: TableSelection<Row>) => void;
      /** Доп. className контейнера. */
      className?: string;
    };

/** Формирует набор индексов страниц с многоточиями для компактной навигации. */
function pageWindow(pageIndex: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  const pages = new Set<number>([0, pageCount - 1, pageIndex]);
  if (pageIndex - 1 > 0) pages.add(pageIndex - 1);
  if (pageIndex + 1 < pageCount - 1) pages.add(pageIndex + 1);
  const sorted = [...pages].filter((p) => p >= 0 && p < pageCount).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  let prev = -1;
  for (const p of sorted) {
    if (prev !== -1 && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}

const ALIGN_CLASS: Record<NonNullable<TableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * Data-driven таблица — вид над уровнем таблицы `@reformer/core/table` поверх презентационного
 * {@link Table}. Режим `settings` создаёт серверную таблицу из `dataProvider`; режим `table`
 * рисует готовую таблицу из стора приложения — клиентскую над массивом модели или серверную.
 *
 * @example Server-driven список с сортировкой и пагинацией
 * ```tsx
 * import { DataGrid, type TableSettings } from '@reformer/ui-kit/table';
 *
 * const settings: TableSettings<User> = {
 *   columns: [
 *     { id: 'name', header: 'Имя', accessor: (u) => u.name, sortable: true },
 *     { id: 'email', header: 'E-mail', accessor: (u) => u.email },
 *   ],
 *   pageSize: 20,
 *   rowKey: (u) => u.id,
 *   dataProvider: async ({ pagination, sorting }, { signal }) => {
 *     const res = await fetch(`/api/users?page=${pagination.pageIndex}&sort=${sorting[0]?.id ?? ''}`, { signal });
 *     const { rows, total } = await res.json();
 *     return { rows, total };
 *   },
 * };
 *
 * <DataGrid settings={settings} />
 * ```
 *
 * @example Таблица из стора приложения: строки — массив модели
 * ```tsx
 * import { arrayOf, createModel, createStore } from '@reformer/core/model';
 * import { createTable } from '@reformer/core/table';
 *
 * const app = createStore(() => {
 *   const model = createModel({ users: arrayOf(blankUser, users) });
 *   const table = createTable({
 *     data: model.$.users,
 *     columns: [{ id: 'name', sortable: true, filterable: true }, { id: 'email' }],
 *     getRowKey: (u) => u.id,
 *     selection: 'multiple',
 *   });
 *   return { model, table };
 * });
 *
 * <DataGrid
 *   table={app.table}
 *   columns={[
 *     { id: 'name', header: 'Имя', accessor: (u) => u.name },
 *     { id: 'email', header: 'E-mail', accessor: (u) => u.email },
 *   ]}
 * />
 * ```
 */
export function DataGrid<Row>(props: DataGridProps<Row>): React.ReactNode {
  if ('table' in props) {
    return (
      <DataGridView
        table={props.table}
        columns={props.columns}
        onSelectionChange={props.onSelectionChange}
        className={props.className}
      />
    );
  }
  const { settings } = props;
  // Состав таблицы фиксируется при создании: сменился — новая таблица (ключ компонента).
  const shape = [
    settings.selection ?? 'none',
    settings.rowKey ? 'key' : 'index',
    ...settings.columns.map((c) => `${c.id}:${c.sortable ? 's' : ''}${c.filterable ? 'f' : ''}`),
  ].join('|');
  return <SettingsDataGrid key={shape} settings={settings} className={props.className} />;
}

/** Режим `settings`: серверная таблица уровня, созданная гридом. */
function SettingsDataGrid<Row>({
  settings,
  className,
}: {
  settings: TableSettings<Row>;
  className?: string;
}): React.ReactNode {
  // Свежие колбэки — через ref: их идентичность меняется на каждый рендер родителя.
  const latest = React.useRef(settings);
  latest.current = settings;
  // Загрузка — после монтирования: на сервере и в отброшенном рендере StrictMode запроса нет.
  const store = useStore(() =>
    createStore(() => {
      const mounted = signal(false);
      const table = createTable<Row, string>({
        dataProvider: (query, ctx) => latest.current.dataProvider(query, ctx),
        enabled: () => mounted.value,
        columns: settings.columns.map((c) => ({
          id: c.id,
          sortable: c.sortable ?? false,
          filterable: c.filterable ?? false,
        })),
        getRowKey: settings.rowKey ? (row) => latest.current.rowKey!(row) : undefined,
        pageSize: settings.pageSize ?? 10,
        selection: settings.selection ?? 'none',
      });
      return {
        table,
        mount: (): void => {
          mounted.value = true;
        },
      };
    })
  );
  const { table } = store;
  React.useEffect(() => store.mount(), [store]);

  // `pageSize` из настроек — не только начальное значение: смена — на первую страницу.
  const pageSize = settings.pageSize ?? 10;
  React.useEffect(() => {
    if (table.pageSize.peek() !== pageSize) table.setPageSize(pageSize);
  }, [table, pageSize]);

  return (
    <DataGridView
      table={table}
      columns={settings.columns}
      onSelectionChange={(selection) => latest.current.onSelectionChange?.(selection)}
      className={className}
    />
  );
}

/** Вид: рисует сигналы таблицы уровня и вызывает её команды. */
function DataGridView<Row>({
  table,
  columns,
  onSelectionChange,
  className,
}: {
  table: TableLevel<Row, string>;
  columns: TableColumn<Row>[];
  onSelectionChange?: (selection: TableSelection<Row>) => void;
  className?: string;
}): React.ReactNode {
  const t = useKitMessages();
  // Общее имя радио-группы режима `single`: без него радио не связаны — стрелки не переводят выбор,
  // а Tab заходит в каждую строку по отдельности.
  const radioGroupName = React.useId();

  const rows = useSignalSnapshot(table.rows);
  const status = useSignalSnapshot(table.status);
  const refreshing = useSignalSnapshot(table.refreshing);
  const error = useSignalSnapshot(table.error);
  const pageIndex = useSignalSnapshot(table.pageIndex);
  const pageCount = useSignalSnapshot(table.pageCount);
  const sorting = useSignalSnapshot(table.sorting);
  const filters = useSignalSnapshot(table.filters);
  const visibleIds = useSignalSnapshot(table.visibleColumns);
  const selectedKeys = useSignalSnapshot(table.selection.keys);
  const allOnPage = useSignalSnapshot(table.selection.allOnPage);
  const selection = table.selection.mode;

  // Выделение наружу — после каждого изменения выбора (не на старте).
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  React.useEffect(
    () =>
      watchField(table.selection.keys, (keys) =>
        onSelectionChangeRef.current?.({
          keys: [...keys],
          rows: [...table.selection.rows.peek()],
        })
      ),
    [table]
  );

  const faces = table.columns as Readonly<Record<string, TableColumnFace>>;
  const faceOf = (id: string): TableColumnFace | undefined =>
    Object.prototype.hasOwnProperty.call(faces, id) ? faces[id] : undefined;
  // Колонка уровня видна по его состоянию; колонка без пары (действия) — всегда.
  const shown = columns.filter((col) => !faceOf(col.id) || visibleIds.includes(col.id));
  const filterable = shown.filter((col) => faceOf(col.id)?.filterable);
  const leafCount = shown.length + (selection === 'none' ? 0 : 1);

  // Ни разу не грузили (`idle` до монтирования) — тот же индикатор, что и первая загрузка.
  const shownStatus = status === 'idle' ? 'loading' : status;
  const errorMessage = error instanceof Error && error.message ? error.message : null;
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  const cellClass = (col: TableColumn<Row>) =>
    cn(col.align ? ALIGN_CLASS[col.align] : undefined, col.className);

  return (
    <div data-slot="data-grid" className={cn('w-full space-y-3', className)}>
      {filterable.length > 0 && (
        <div data-slot="data-grid-toolbar" className="flex flex-wrap items-center gap-2">
          {filterable.map((col) => {
            // Плейсхолдер — не подпись: он исчезает при вводе и читается не всеми скринридерами.
            const headerText =
              typeof col.header === 'string' || typeof col.header === 'number'
                ? String(col.header)
                : col.id;
            return (
              <input
                key={col.id}
                type="text"
                data-slot="data-grid-filter"
                data-testid={`filter-${col.id}`}
                aria-label={col.filterLabel ?? t('kit.table.filter', { column: headerText })}
                placeholder={col.filterPlaceholder ?? col.id}
                value={String(filters[col.id] ?? '')}
                onChange={(e) => faceOf(col.id)!.setFilter(e.target.value || undefined)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            );
          })}
        </div>
      )}

      <AsyncBoundary
        status={shownStatus}
        refreshing={refreshing}
        error={errorMessage ?? t('kit.table.loadError')}
        onRetry={() => table.reload()}
      >
        <div
          data-slot="data-grid-ready"
          className={cn('space-y-3 transition-opacity', refreshing && 'opacity-60')}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {selection !== 'none' && (
                  <TableHead>
                    {selection === 'multiple' ? (
                      <input
                        type="checkbox"
                        aria-label={t('kit.table.selectAll')}
                        checked={allOnPage}
                        onChange={() => table.selection.toggleAllOnPage()}
                      />
                    ) : null}
                  </TableHead>
                )}
                {shown.map((col) => {
                  const face = faceOf(col.id);
                  const sortIndex = sorting.findIndex((entry) => entry.id === col.id);
                  const sortDir =
                    sortIndex === -1 ? null : sorting[sortIndex]!.desc ? 'desc' : 'asc';
                  // aria-sort — только у главной колонки сортировки: по ARIA он ставится на
                  // один заголовок за раз.
                  const ariaSort =
                    sortIndex === 0 ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined;
                  return (
                    <TableHead key={col.id} aria-sort={ariaSort} className={cellClass(col)}>
                      {face?.sortable ? (
                        <button
                          type="button"
                          data-slot="data-grid-sort"
                          onClick={(e) => face.toggleSort({ multi: e.shiftKey })}
                          className="inline-flex items-center gap-1 select-none hover:text-foreground"
                        >
                          {col.header}
                          {sortDir === 'asc' ? (
                            <ArrowUp className="size-3.5" />
                          ) : sortDir === 'desc' ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={leafCount} className="h-24 text-center text-muted-foreground">
                    {t('kit.table.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const selected = selectedKeys.has(row.key);
                  return (
                    <TableRow key={row.key} data-state={selected ? 'selected' : undefined}>
                      {selection !== 'none' && (
                        <TableCell>
                          <input
                            type={selection === 'multiple' ? 'checkbox' : 'radio'}
                            name={selection === 'single' ? radioGroupName : undefined}
                            aria-label={t('kit.table.selectRow')}
                            checked={selected}
                            onChange={() =>
                              selection === 'multiple' ? row.toggle() : row.select()
                            }
                          />
                        </TableCell>
                      )}
                      {shown.map((col) => (
                        <TableCell key={col.id} className={cellClass(col)}>
                          {col.accessor?.(row.value) ?? null}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {pageCount > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={!canPrev}
                    className={cn(!canPrev && 'pointer-events-none opacity-50')}
                    onClick={(e) => {
                      e.preventDefault();
                      table.prevPage();
                    }}
                  />
                </PaginationItem>
                {pageWindow(pageIndex, pageCount).map((p, i) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`e-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === pageIndex}
                        onClick={(e) => {
                          e.preventDefault();
                          table.setPage(p);
                        }}
                      >
                        {p + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={!canNext}
                    className={cn(!canNext && 'pointer-events-none opacity-50')}
                    onClick={(e) => {
                      e.preventDefault();
                      table.nextPage();
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </AsyncBoundary>
    </div>
  );
}
