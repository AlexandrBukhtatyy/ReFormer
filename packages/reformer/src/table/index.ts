/**
 * `@reformer/core/table` — уровень таблицы над моделью приложения.
 *
 * - `createTable({ columns, data | dataProvider, … })` — сортировка (в том числе по нескольким
 *   колонкам), фильтры, страницы, видимость колонок и выбор строк сигналами; лица колонок
 *   (`table.columns.<id>`) и строк (`table.rows`).
 * - Клиентский режим (`data`) — строки массива модели: правка строки формой сразу видна таблице.
 * - Серверный режим (`dataProvider(query, { signal })`) — страница с сервера, устаревшие запросы
 *   отменяются, одно действие — один запрос.
 *
 * Отрисовки здесь нет: вид — `DataGrid` из `@reformer/ui-kit/table` (`<DataGrid table={…}>`) или
 * своя разметка на `useSignalSnapshot` из `@reformer/core/react`.
 *
 * @group Table
 * @module table
 */

export { createTable } from './create-table';
export type {
  ClientTableOptions,
  ColumnDef,
  RowKey,
  RowModel,
  SelectionMode,
  ServerTableOptions,
  SortDirection,
  SortEntry,
  Table,
  TableColumnFace,
  TableCommonOptions,
  TableFilters,
  TableOptions,
  TablePage,
  TableQuery,
  TableRow,
  TableSelection,
  TableStateBindings,
} from './types';
