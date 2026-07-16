import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  DataGrid,
  type TableSettings,
  type TableQuery,
  type TablePage,
} from '@reformer/ui-kit/table';
import { Badge } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Table — не form-control, два уровня. base — дословный shadcn-набор (Table / TableHeader /
 * TableBody / TableFooter / TableRow / TableHead / TableCell / TableCaption) для ручной вёрстки.
 * DataGrid — data-driven обёртка: движок @tanstack/react-table с manual pagination / sorting /
 * filtering, поэтому реальную сортировку / пагинацию / фильтрацию делает dataProvider (server-driven),
 * а loading / error / empty показываются через AsyncBoundary + State; навигация — компонент Pagination.
 * SUBPATH-ONLY: тяжёлый @tanstack/react-table — импорт из @reformer/ui-kit/table.
 */

interface User {
  id: number;
  name: string;
  email: string;
  role: 'Админ' | 'Пользователь' | 'Гость';
}

const ROLES: User['role'][] = ['Админ', 'Пользователь', 'Гость'];
const ALL_USERS: User[] = Array.from({ length: 43 }, (_, i) => ({
  id: i + 1,
  name: `Пользователь ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: ROLES[i % 3],
}));

/** Mock server: эмулирует фильтрацию / сортировку / пагинацию по массиву в памяти. */
function mockDataProvider({ filters, pagination, sorting }: TableQuery): Promise<TablePage<User>> {
  let data = [...ALL_USERS];

  const nameFilter = filters.name;
  if (typeof nameFilter === 'string' && nameFilter.trim()) {
    const q = nameFilter.toLowerCase();
    data = data.filter((u) => u.name.toLowerCase().includes(q));
  }

  const sort = sorting[0];
  if (sort) {
    data.sort((a, b) => {
      const av = a[sort.id as keyof User];
      const bv = b[sort.id as keyof User];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.desc ? -cmp : cmp;
    });
  }

  const total = data.length;
  const start = pagination.pageIndex * pagination.pageSize;
  const rows = data.slice(start, start + pagination.pageSize);

  return new Promise((resolve) => setTimeout(() => resolve({ rows, total }), 350));
}

const roleCell = (u: User) => (
  <Badge variant={u.role === 'Админ' ? 'default' : 'secondary'}>{u.role}</Badge>
);

const gridSettings: TableSettings<User> = {
  columns: [
    { id: 'id', header: 'ID', accessor: (u) => u.id, sortable: true, align: 'left' },
    {
      id: 'name',
      header: 'Имя',
      accessor: (u) => u.name,
      sortable: true,
      filterable: true,
      filterPlaceholder: 'Поиск по имени',
    },
    { id: 'email', header: 'E-mail', accessor: (u) => u.email },
    { id: 'role', header: 'Роль', accessor: roleCell, align: 'center' },
  ],
  pageSize: 8,
  rowKey: (u) => u.id,
  dataProvider: mockDataProvider,
};

const selectionSettings: TableSettings<User> = {
  ...gridSettings,
  pageSize: 5,
  selection: 'multiple',
};

const emptySettings: TableSettings<User> = {
  columns: gridSettings.columns,
  rowKey: (u) => u.id,
  dataProvider: () => Promise.resolve({ rows: [], total: 0 }),
};

export const tableDocConfig: ComponentDocConfig = {
  name: 'Table',
  importFrom: '@reformer/ui-kit/table',
  description:
    'Не form-control, два уровня. base — дословный shadcn-набор частей (Table / TableHeader / TableBody / TableFooter / TableRow / TableHead / TableCell / TableCaption) для ручной вёрстки. DataGrid — data-driven обёртка (движок @tanstack/react-table, manual pagination / sorting / filtering): держит состояние, тянет строки из dataProvider, показывает loading / error / empty через AsyncBoundary + State, навигация — Pagination. SUBPATH-ONLY: тяжёлый @tanstack/react-table — импорт из @reformer/ui-kit/table.',
  variants: [
    {
      id: 'presentational',
      title: 'Презентационная вёрстка (base)',
      description:
        'Ручная разметка из под-частей shadcn: Table оборачивает <table> в скролл-контейнер, остальные части — тонкие стилизованные обёртки над thead/tbody/tfoot/tr/th/td/caption. Никакой логики — данные подставляешь сам.',
      render: () => (
        <Table>
          <TableCaption>Список последних платежей</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Счёт</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">INV-001</TableCell>
              <TableCell>Оплачен</TableCell>
              <TableCell className="text-right">₽ 2 500</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">INV-002</TableCell>
              <TableCell>Ожидает</TableCell>
              <TableCell className="text-right">₽ 1 200</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Итого</TableCell>
              <TableCell className="text-right">₽ 3 700</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ),
      code: `<Table>
  <TableCaption>Список последних платежей</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Счёт</TableHead>
      <TableHead>Статус</TableHead>
      <TableHead className="text-right">Сумма</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="font-medium">INV-001</TableCell>
      <TableCell>Оплачен</TableCell>
      <TableCell className="text-right">₽ 2 500</TableCell>
    </TableRow>
  </TableBody>
  <TableFooter>
    <TableRow>
      <TableCell colSpan={2}>Итого</TableCell>
      <TableCell className="text-right">₽ 3 700</TableCell>
    </TableRow>
  </TableFooter>
</Table>`,
    },
    {
      id: 'data-grid',
      title: 'DataGrid — server-driven (mock)',
      description:
        'DataGrid c mock-dataProvider (массив в памяти, эмулирует фильтр по имени, сортировку по клику на заголовок и постраничную выдачу). Клик по «Имя» / «ID» шлёт новый sorting; ввод в фильтр — новый filters; клик по странице — новый pagination. Каждое изменение — новый вызов dataProvider с задержкой (виден LoadingState).',
      render: () => <DataGrid settings={gridSettings} />,
      code: `const settings: TableSettings<User> = {
  columns: [
    { id: 'id', header: 'ID', accessor: (u) => u.id, sortable: true },
    {
      id: 'name',
      header: 'Имя',
      accessor: (u) => u.name,
      sortable: true,
      filterable: true,
      filterPlaceholder: 'Поиск по имени',
    },
    { id: 'email', header: 'E-mail', accessor: (u) => u.email },
    { id: 'role', header: 'Роль', accessor: (u) => <Badge>{u.role}</Badge>, align: 'center' },
  ],
  pageSize: 8,
  rowKey: (u) => u.id,
  // dataProvider вызывается при каждом изменении filters / sorting / pagination
  dataProvider: async ({ filters, pagination, sorting }) => {
    const res = await fetch(buildUrl({ filters, pagination, sorting }));
    const { rows, total } = await res.json();
    return { rows, total };
  },
};

<DataGrid settings={settings} />`,
    },
    {
      id: 'data-grid-selection',
      title: 'DataGrid — выделение строк',
      description:
        'selection="multiple" добавляет ведущую колонку с чекбоксами (в шапке — «выбрать все на странице»); selection="single" даёт радио-выбор одной строки. Выделение хранится по rowKey.',
      render: () => <DataGrid settings={selectionSettings} />,
      code: `const settings: TableSettings<User> = {
  columns: [...],
  pageSize: 5,
  rowKey: (u) => u.id,
  selection: 'multiple', // 'none' | 'single' | 'multiple'
  dataProvider,
};

<DataGrid settings={settings} />`,
    },
  ],
  examples: [
    {
      id: 'empty',
      title: 'Пустой результат',
      description:
        'Когда dataProvider вернул { rows: [], total: 0 } — DataGrid (в состоянии ready) рисует таблицу с одной строкой «Нет данных», без пагинации. loading и error — отдельные состояния через AsyncBoundary.',
      render: () => <DataGrid settings={emptySettings} />,
      code: `const settings: TableSettings<User> = {
  columns,
  rowKey: (u) => u.id,
  dataProvider: () => Promise.resolve({ rows: [], total: 0 }),
};

<DataGrid settings={settings} />`,
    },
    {
      id: 'error-retry',
      title: 'Ошибка загрузки и повтор',
      description:
        'Если dataProvider отклонил промис — DataGrid показывает ErrorState (role="alert") с текстом ошибки и кнопкой «Повторить», которая заново дёргает dataProvider с текущими filters / sorting / pagination.',
      render: () => <DataGrid settings={gridSettings} />,
      code: `const settings: TableSettings<Order> = {
  columns,
  rowKey: (o) => o.id,
  dataProvider: async (query) => {
    const res = await fetch(buildUrl(query));
    if (!res.ok) throw new Error('Сервис временно недоступен');
    return res.json();
  },
};

// при reject → ErrorState с кнопкой «Повторить»
<DataGrid settings={settings} />`,
    },
  ],
  props: [
    {
      name: 'settings.dataProvider',
      type: '(query: TableQuery) => Promise<TablePage<Row>>',
      description:
        'Провайдер данных (обязателен). query = { filters: Record<string, unknown>; pagination: { pageIndex, pageSize }; sorting: { id, desc }[] }. Возвращает { rows, total }. Вызывается при монтировании и при любом изменении filters / sorting / pagination. Reject → состояние ошибки с повтором.',
    },
    {
      name: 'settings.columns',
      type: 'TableColumn<Row>[]',
      description:
        'Колонки. TableColumn = { id; header; accessor?(row); sortable?; filterable?; filterPlaceholder?; align?; className? }. accessor возвращает ReactNode (можно Badge/ссылку). sortable → кликабельный заголовок с индикатором; filterable → текстовый фильтр в тулбаре (id колонки → filters[id]).',
    },
    {
      name: 'settings.pageSize',
      type: 'number',
      default: '10',
      description: 'Размер страницы; передаётся в dataProvider как pagination.pageSize.',
    },
    {
      name: 'settings.rowKey',
      type: '(row: Row) => string | number',
      description:
        'Стабильный ключ строки — React-key и идентификатор для выделения. По умолчанию — индекс строки.',
    },
    {
      name: 'settings.selection',
      type: "'none' | 'single' | 'multiple'",
      default: "'none'",
      description:
        'Режим выделения. single — радио на строку; multiple — чекбоксы + «выбрать все на странице» в шапке.',
    },
    {
      name: 'Table / TableHeader / TableBody / …',
      type: 'React.ComponentProps<...>',
      description:
        'Презентационные под-части (base) для ручной вёрстки. Table оборачивает <table> в data-slot="table-container" со скроллом (overflow-x-auto). Все части несут собственный data-slot, мёржат className (tailwind-merge) и прокидывают произвольные props.',
    },
  ],
};
