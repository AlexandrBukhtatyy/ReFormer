// table — два уровня:
//  1) base — дословный shadcn Table (презентационный набор: Table / TableHeader / TableBody /
//     TableFooter / TableRow / TableHead / TableCell / TableCaption) для ручной вёрстки.
//  2) DataGrid — вид над уровнем таблицы `@reformer/core/table`: состояние (сортировка, фильтры,
//     страницы, выбор, загрузка) держит уровень, грид рисует его и вызывает команды. Режимы:
//     `settings` (серверная таблица из dataProvider) и `table` (готовая таблица из стора).
//     Loading/error/empty — через AsyncBoundary, навигация — Pagination.
// Не form-control. SUBPATH-ONLY: импортируется через `@reformer/ui-kit/table`.
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './variants/base/table-base';

export { DataGrid } from './variants/data-grid/table-data-grid';
export type {
  DataGridProps,
  TableSettings,
  TableColumn,
  TableQuery,
  TablePage,
  TableFilters,
  TableSelection,
  TableSelectionMode,
} from './variants/data-grid/table-data-grid';
