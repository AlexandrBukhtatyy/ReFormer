// table — два уровня:
//  1) base — дословный shadcn Table (презентационный набор: Table / TableHeader / TableBody /
//     TableFooter / TableRow / TableHead / TableCell / TableCaption) для ручной вёрстки.
//  2) DataGrid — data-driven обёртка (движок @tanstack/react-table, manual pagination/sorting/
//     filtering): держит состояние, тянет строки из dataProvider, показывает loading/error/empty
//     через AsyncBoundary + State, навигация — Pagination.
// Не form-control. SUBPATH-ONLY: тяжёлая dep @tanstack/react-table (optional peer) — компонент
// живёт вне главного barrel, импортируется через `@reformer/ui-kit/table`.
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
  TableSelectionMode,
} from './variants/data-grid/table-data-grid';
