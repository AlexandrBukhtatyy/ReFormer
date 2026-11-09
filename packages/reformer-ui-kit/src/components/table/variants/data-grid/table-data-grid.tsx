import { useKitMessages } from '@/i18n/messages';
import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type PaginationState,
  type ColumnFiltersState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AsyncBoundary, type AsyncStatus } from '@/components/async-boundary';
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

// DataGrid — data-driven обёртка над презентационным Table (variants/base). Не form-control.
// Держит состояние pagination / sorting / column-filters / row-selection, а данные получает
// из `dataProvider` (server-driven): движок @tanstack/react-table с manual* = true, поэтому
// сортировка / пагинация / фильтрация НЕ выполняются в памяти — их реализует dataProvider.
// Состояния loading / error / empty показываются через AsyncBoundary (его встроенные блоки
// загрузки и ошибки); навигация по страницам — через компонент Pagination. Тяжёлая dep
// @tanstack/react-table (optional peer) — компонент живёт вне главного barrel, subpath
// `@reformer/ui-kit/table`.

/** Режим выделения строк DataGrid. */
export type TableSelectionMode = 'none' | 'single' | 'multiple';

/** Плоская карта активных фильтров: id колонки → значение фильтра. */
export type TableFilters = Record<string, unknown>;

/** Аргумент запроса, который DataGrid передаёт в {@link TableSettings.dataProvider}. */
export interface TableQuery {
  /** Активные фильтры колонок (id → значение). Пустая карта, если фильтров нет. */
  filters: TableFilters;
  /** Текущая страница (`pageIndex` с 0) и размер страницы. */
  pagination: { pageIndex: number; pageSize: number };
  /** Активная сортировка (порядок значим). `desc` — по убыванию. */
  sorting: { id: string; desc: boolean }[];
}

/** Результат {@link TableSettings.dataProvider}: строки текущей страницы + общее число строк. */
export interface TablePage<Row> {
  /** Строки текущей страницы. */
  rows: Row[];
  /** Общее число строк во всём наборе (для расчёта числа страниц). */
  total: number;
}

/** Описание одной колонки DataGrid. */
export interface TableColumn<Row> {
  /** Уникальный id колонки (ключ; попадает в `sorting[].id` и `filters`). */
  id: string;
  /** Заголовок колонки. */
  header: React.ReactNode;
  /** Извлекатель содержимого ячейки из строки. Если не задан — ячейка пустая. */
  accessor?: (row: Row) => React.ReactNode;
  /** Разрешить сортировку по колонке (кликабельный заголовок). По умолчанию `false`. */
  sortable?: boolean;
  /** Разрешить фильтрацию по колонке (текстовый инпут в тулбаре). По умолчанию `false`. */
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

/** Выбранные строки DataGrid — аргумент {@link TableSettings.onSelectionChange}. */
export interface TableSelection<Row> {
  /** Ключи выбранных строк: `String(rowKey(row))`, без `rowKey` — индекс строки на странице. */
  keys: string[];
  /** Сами выбранные строки (в том числе выбранные на других страницах — при заданном `rowKey`). */
  rows: Row[];
}

/** Контракт настроек DataGrid. */
export interface TableSettings<Row> {
  /**
   * Провайдер данных. Вызывается при монтировании и при любом изменении
   * pagination / sorting / filters. Должен вернуть строки текущей страницы и общее
   * число строк. Отклонение промиса → состояние ошибки с кнопкой «Повторить».
   */
  dataProvider: (query: TableQuery) => Promise<TablePage<Row>>;
  /** Колонки таблицы. */
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

/** Props {@link DataGrid}. */
export interface DataGridProps<Row> {
  /** Настройки грида (data-provider, колонки, пагинация, выделение). */
  settings: TableSettings<Row>;
  /** Доп. className контейнера. */
  className?: string;
}

const SELECT_COLUMN_ID = '__select__';

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
 * Data-driven таблица поверх презентационного {@link Table}. Держит состояние
 * пагинации / сортировки / фильтров, получает строки из `settings.dataProvider`
 * (server-driven, `manual*` у @tanstack/react-table), а loading / error / empty
 * показывает через AsyncBoundary + State. Навигация по страницам — Pagination.
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
 *   dataProvider: async ({ pagination, sorting }) => {
 *     const res = await fetch(`/api/users?page=${pagination.pageIndex}&sort=${sorting[0]?.id ?? ''}`);
 *     const { rows, total } = await res.json();
 *     return { rows, total };
 *   },
 * };
 *
 * <DataGrid settings={settings} />
 * ```
 *
 * @example Выбор строк для массового действия
 * ```tsx
 * const [selected, setSelected] = useState<User[]>([]);
 *
 * <DataGrid
 *   settings={{
 *     ...settings,
 *     selection: 'multiple',
 *     rowKey: (u) => u.id, // без rowKey выбор сбрасывается при смене страницы
 *     onSelectionChange: ({ rows }) => setSelected(rows),
 *   }}
 * />
 * <Button disabled={selected.length === 0} onClick={() => archive(selected)}>В архив</Button>
 * ```
 */
export function DataGrid<Row>({ settings, className }: DataGridProps<Row>): React.ReactNode {
  const t = useKitMessages();
  const {
    dataProvider,
    columns,
    pageSize = 10,
    rowKey,
    selection = 'none',
    onSelectionChange,
  } = settings;
  // Общее имя радио-группы режима `single`: без него радио не связаны — стрелки не переводят выбор,
  // а Tab заходит в каждую строку по отдельности.
  const radioGroupName = React.useId();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState<AsyncStatus>('loading');
  // Первая страница уже показана. Дальше перезагрузка не подменяет таблицу индикатором: подмена
  // размонтировала кнопку сортировки или ссылку страницы под фокусом, и фокус улетал в body.
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  // Текст сбоя без сообщения ошибки — из словаря при показе, чтобы менялся вместе с языком.
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  // `pageSize` из настроек — не только начальное значение. Подстройка во время рендера, а не
  // эффектом: эффект успел бы отправить запрос со старым размером.
  const [appliedPageSize, setAppliedPageSize] = React.useState(pageSize);
  if (appliedPageSize !== pageSize) {
    setAppliedPageSize(pageSize);
    setPagination({ pageIndex: 0, pageSize });
  }
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Пагинация серверная (`manualPagination`), а при ней @tanstack страницу сам не сбрасывает:
  // фильтр, сузивший выборку, оставлял на 3-й странице — «Нет данных».
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    setColumnFilters(updater);
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  };

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  // Стабильная ссылка на dataProvider — чтобы её identity не гоняла fetch-эффект.
  const dataProviderRef = React.useRef(dataProvider);
  dataProviderRef.current = dataProvider;
  const hasRowKeyRef = React.useRef(rowKey !== undefined);
  hasRowKeyRef.current = rowKey !== undefined;

  const reqId = React.useRef(0);
  React.useEffect(() => {
    const id = ++reqId.current;
    setStatus('loading');
    const filters: TableFilters = Object.fromEntries(columnFilters.map((f) => [f.id, f.value]));
    Promise.resolve(
      dataProviderRef.current({
        filters,
        pagination: { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize },
        sorting: sorting.map((s) => ({ id: s.id, desc: s.desc })),
      })
    )
      .then((res) => {
        if (id !== reqId.current) return;
        setRows(res.rows);
        setTotal(res.total);
        setStatus('ready');
        setLoadedOnce(true);
        // Без rowKey ключ строки — её индекс: в новых строках тот же индекс — уже другая строка,
        // и выбор «переехал» бы на неё.
        if (!hasRowKeyRef.current) {
          setRowSelection((current) => (Object.keys(current).length === 0 ? current : {}));
        }
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return;
        setErrorMsg(err instanceof Error ? err.message : null);
        setStatus('error');
      });
  }, [sorting, pagination, columnFilters, reloadKey]);

  // Выделение наружу. Строки выбранных ключей копятся здесь: выбранная на другой странице строка
  // в `rows` уже не лежит, а снаружи нужна сама строка, а не только её ключ.
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const selectedRowsRef = React.useRef(new Map<string, Row>());
  const notifiedSelectionRef = React.useRef(rowSelection);
  React.useEffect(() => {
    // Сравнение со снимком, а не флаг «первый запуск»: StrictMode запускает эффект дважды.
    if (notifiedSelectionRef.current === rowSelection) return;
    notifiedSelectionRef.current = rowSelection;
    const pageRows = new Map(rows.map((row, i) => [rowKey ? String(rowKey(row)) : String(i), row]));
    const selected = new Map<string, Row>();
    for (const [key, isSelected] of Object.entries(rowSelection)) {
      if (!isSelected) continue;
      const row = pageRows.get(key) ?? selectedRowsRef.current.get(key);
      if (row !== undefined) selected.set(key, row);
    }
    selectedRowsRef.current = selected;
    onSelectionChangeRef.current?.({ keys: [...selected.keys()], rows: [...selected.values()] });
  }, [rowSelection, rows, rowKey]);

  const tableColumns = React.useMemo<ColumnDef<Row>[]>(() => {
    const defs: ColumnDef<Row>[] = columns.map((col) => ({
      id: col.id,
      // Без `accessorFn` @tanstack считает колонку несортируемой (`getCanSort()` ложно), и клик по
      // заголовку ничего не делал. Само значение в сортировку не идёт: она серверная.
      accessorFn: (row) => col.accessor?.(row) ?? null,
      // Первый клик — по возрастанию. Иначе направление выводится из значения первой строки, и для
      // не-строки (число, элемент) первым шло бы «по убыванию».
      sortDescFirst: false,
      header: () => col.header,
      cell: (ctx) => col.accessor?.(ctx.row.original) ?? null,
      enableSorting: col.sortable ?? false,
    }));
    if (selection !== 'none') {
      defs.unshift({
        id: SELECT_COLUMN_ID,
        enableSorting: false,
        header: ({ table }) =>
          selection === 'multiple' ? (
            <input
              type="checkbox"
              aria-label={t('kit.table.selectAll')}
              checked={table.getIsAllPageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
          ) : null,
        cell: ({ row }) => (
          <input
            type={selection === 'multiple' ? 'checkbox' : 'radio'}
            name={selection === 'single' ? radioGroupName : undefined}
            aria-label={t('kit.table.selectRow')}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      });
    }
    return defs;
  }, [columns, selection, t, radioGroupName]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    enableRowSelection: selection !== 'none',
    enableMultiRowSelection: selection === 'multiple',
    state: { sorting, pagination, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
    getRowId: rowKey ? (row) => String(rowKey(row)) : undefined,
  });

  const filterableColumns = columns.filter((c) => c.filterable);
  const leafCount = tableColumns.length;

  const goToPage = (pageIndex: number) =>
    table.setPageIndex(Math.min(Math.max(pageIndex, 0), pageCount - 1));

  // Перезагрузка после первой страницы — фоновое обновление: таблица остаётся (и фокус в ней),
  // регион помечается `aria-busy`.
  const refreshing = loadedOnce && status === 'loading';

  return (
    <div data-slot="data-grid" className={cn('w-full space-y-3', className)}>
      {filterableColumns.length > 0 && (
        <div data-slot="data-grid-toolbar" className="flex flex-wrap items-center gap-2">
          {filterableColumns.map((col) => {
            const column = table.getColumn(col.id);
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
                value={String(column?.getFilterValue() ?? '')}
                onChange={(e) => column?.setFilterValue(e.target.value || undefined)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            );
          })}
        </div>
      )}

      <AsyncBoundary
        status={refreshing ? 'ready' : status}
        refreshing={refreshing}
        error={errorMsg ?? t('kit.table.loadError')}
        onRetry={() => setReloadKey((k) => k + 1)}
      >
        <div
          data-slot="data-grid-ready"
          className={cn('space-y-3 transition-opacity', refreshing && 'opacity-60')}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const col = columns.find((c) => c.id === header.column.id);
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    // aria-sort — только у главной колонки сортировки: по ARIA он ставится на
                    // один заголовок за раз.
                    const ariaSort =
                      sortDir && header.column.getSortIndex() === 0
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined;
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={ariaSort}
                        className={cn(
                          col?.align ? ALIGN_CLASS[col.align] : undefined,
                          col?.className
                        )}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            data-slot="data-grid-sort"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 select-none hover:text-foreground"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDir === 'asc' ? (
                              <ArrowUp className="size-3.5" />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown className="size-3.5" />
                            ) : (
                              <ChevronsUpDown className="size-3.5 opacity-50" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={leafCount} className="h-24 text-center text-muted-foreground">
                    {t('kit.table.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                    {row.getVisibleCells().map((cell) => {
                      const col = columns.find((c) => c.id === cell.column.id);
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            col?.align ? ALIGN_CLASS[col.align] : undefined,
                            col?.className
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pageCount > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={!table.getCanPreviousPage()}
                    className={cn(!table.getCanPreviousPage() && 'pointer-events-none opacity-50')}
                    onClick={(e) => {
                      e.preventDefault();
                      if (table.getCanPreviousPage()) table.previousPage();
                    }}
                  />
                </PaginationItem>
                {pageWindow(pagination.pageIndex, pageCount).map((p, i) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`e-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === pagination.pageIndex}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(p);
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
                    aria-disabled={!table.getCanNextPage()}
                    className={cn(!table.getCanNextPage() && 'pointer-events-none opacity-50')}
                    onClick={(e) => {
                      e.preventDefault();
                      if (table.getCanNextPage()) table.nextPage();
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
