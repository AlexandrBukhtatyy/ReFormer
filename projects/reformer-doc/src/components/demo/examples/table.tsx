import { useState } from 'react';
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
 * Table — не поле формы, два уровня. Части Table… — разметка таблицы руками. DataGrid — таблица,
 * которая сама запрашивает страницы у `dataProvider` и рисует загрузку, ошибку и пустой результат.
 * Импорт только из `@reformer/ui-kit/table`: DataGrid тянет необязательную зависимость
 * `@tanstack/react-table`. Variants — оба уровня, Examples — состояния DataGrid, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

interface User {
  id: number;
  name: string;
  email: string;
  role: 'Админ' | 'Пользователь' | 'Гость';
}

const ROLES: User['role'][] = ['Админ', 'Пользователь', 'Гость'];
const USERS: User[] = Array.from({ length: 43 }, (_, i) => ({
  id: i + 1,
  name: `Пользователь ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: ROLES[i % 3],
}));

// Имитация сервера: фильтр, сортировка и страница считаются по массиву в памяти.
function fakeServer({ filters, sorting, pagination }: TableQuery): Promise<TablePage<User>> {
  const query = String(filters.name ?? '').toLowerCase();
  const sort = sorting[0];
  const found = USERS.filter((u) => u.name.toLowerCase().includes(query));
  if (sort) {
    const key = sort.id as keyof User;
    found.sort((a, b) => String(a[key]).localeCompare(String(b[key]), 'ru', { numeric: true }));
    if (sort.desc) found.reverse();
  }
  const start = pagination.pageIndex * pagination.pageSize;
  const page = { rows: found.slice(start, start + pagination.pageSize), total: found.length };
  return new Promise((resolve) => setTimeout(() => resolve(page), 350));
}

const gridSettings: TableSettings<User> = {
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
    {
      id: 'role',
      header: 'Роль',
      accessor: (u) => (
        <Badge variant={u.role === 'Админ' ? 'default' : 'secondary'}>{u.role}</Badge>
      ),
      align: 'center',
    },
  ],
  pageSize: 8,
  rowKey: (u) => u.id,
  dataProvider: fakeServer,
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

// Первый запрос падает, повтор проходит — чтобы показать блок ошибки и кнопку «Повторить».
function FlakyGrid() {
  const [settings] = useState<TableSettings<User>>(() => {
    let calls = 0;
    return {
      ...gridSettings,
      pageSize: 5,
      dataProvider: (query) => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error('Сервис временно недоступен'));
        return fakeServer(query);
      },
    };
  });
  return <DataGrid settings={settings} />;
}

export const tableDocConfig: ComponentDocConfig = {
  name: 'Table',
  importFrom: '@reformer/ui-kit/table',
  description:
    'Части Table… для разметки таблицы руками и DataGrid — таблица, которая сама запрашивает страницы данных.',
  variants: [
    {
      id: 'presentational',
      title: 'Разметка из частей',
      description:
        'Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption — стилизованные теги таблицы. Данные подставляете сами.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 520 }}>
          <Table>
            <TableCaption>Последние платежи</TableCaption>
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
                <TableCell className="text-right">2 500 ₽</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV-002</TableCell>
                <TableCell>Ожидает</TableCell>
                <TableCell className="text-right">1 200 ₽</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Итого</TableCell>
                <TableCell className="text-right">3 700 ₽</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ),
      code: `<Table>
  <TableCaption>Последние платежи</TableCaption>
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
      <TableCell className="text-right">2 500 ₽</TableCell>
    </TableRow>
    <TableRow>
      <TableCell className="font-medium">INV-002</TableCell>
      <TableCell>Ожидает</TableCell>
      <TableCell className="text-right">1 200 ₽</TableCell>
    </TableRow>
  </TableBody>
  <TableFooter>
    <TableRow>
      <TableCell colSpan={2}>Итого</TableCell>
      <TableCell className="text-right">3 700 ₽</TableCell>
    </TableRow>
  </TableFooter>
</Table>`,
    },
    {
      id: 'data-grid',
      title: 'DataGrid: страницы и фильтр',
      description:
        'dataProvider получает { filters, sorting, pagination } и возвращает { rows, total }. Ввод в фильтр и переход по страницам — новый запрос; на время запроса виден блок загрузки.',
      render: () => (
        <div style={{ width: '100%' }}>
          <DataGrid settings={gridSettings} />
        </div>
      ),
      code: `// Имитация сервера: фильтр, сортировка и страница считаются по массиву в памяти.
function fakeServer({ filters, sorting, pagination }: TableQuery): Promise<TablePage<User>> {
  const query = String(filters.name ?? '').toLowerCase();
  const sort = sorting[0];
  const found = USERS.filter((u) => u.name.toLowerCase().includes(query));
  if (sort) {
    const key = sort.id as keyof User;
    found.sort((a, b) => String(a[key]).localeCompare(String(b[key]), 'ru', { numeric: true }));
    if (sort.desc) found.reverse();
  }
  const start = pagination.pageIndex * pagination.pageSize;
  const page = { rows: found.slice(start, start + pagination.pageSize), total: found.length };
  return new Promise((resolve) => setTimeout(() => resolve(page), 350));
}

const gridSettings: TableSettings<User> = {
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
    {
      id: 'role',
      header: 'Роль',
      accessor: (u) => (
        <Badge variant={u.role === 'Админ' ? 'default' : 'secondary'}>{u.role}</Badge>
      ),
      align: 'center',
    },
  ],
  pageSize: 8,
  rowKey: (u) => u.id,
  dataProvider: fakeServer,
};

<DataGrid settings={gridSettings} />`,
    },
    {
      id: 'data-grid-selection',
      title: 'DataGrid: выбор строк',
      description:
        'selection="multiple" добавляет колонку флажков и флажок «выбрать все на странице» в шапке. selection="single" — переключатель на строку.',
      render: () => (
        <div style={{ width: '100%' }}>
          <DataGrid settings={selectionSettings} />
        </div>
      ),
      code: `const selectionSettings: TableSettings<User> = {
  ...gridSettings,
  pageSize: 5,
  selection: 'multiple', // 'none' | 'single' | 'multiple'
};

<DataGrid settings={selectionSettings} />`,
    },
  ],
  examples: [
    {
      id: 'empty',
      title: 'Пустой результат',
      description:
        'dataProvider вернул { rows: [], total: 0 }: шапка остаётся, в теле одна строка «Нет данных», пагинации нет.',
      render: () => (
        <div style={{ width: '100%' }}>
          <DataGrid settings={emptySettings} />
        </div>
      ),
      code: `const emptySettings: TableSettings<User> = {
  columns: gridSettings.columns,
  rowKey: (u) => u.id,
  dataProvider: () => Promise.resolve({ rows: [], total: 0 }),
};

<DataGrid settings={emptySettings} />`,
    },
    {
      id: 'error-retry',
      title: 'Ошибка загрузки и повтор',
      description:
        'Первый запрос здесь падает. DataGrid показывает текст ошибки и кнопку «Повторить» — она повторяет запрос с теми же страницей и фильтром.',
      render: () => (
        <div style={{ width: '100%' }}>
          <FlakyGrid />
        </div>
      ),
      code: `// Первый запрос падает, повтор проходит — чтобы показать блок ошибки и кнопку «Повторить».
function FlakyGrid() {
  const [settings] = useState<TableSettings<User>>(() => {
    let calls = 0;
    return {
      ...gridSettings,
      pageSize: 5,
      dataProvider: (query) => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error('Сервис временно недоступен'));
        return fakeServer(query);
      },
    };
  });
  return <DataGrid settings={settings} />;
}`,
    },
  ],
  props: [
    {
      name: 'Table, TableHeader, …',
      type: "ComponentProps<'table'>, <'thead'>, …",
      description:
        'Части принимают атрибуты своего HTML-тега (colSpan, scope, data-*) и className. Table дополнительно оборачивает <table> в контейнер с горизонтальной прокруткой.',
    },
    {
      name: 'DataGrid.settings',
      type: 'TableSettings<Row>',
      description: 'Обязательный. Колонки, источник данных, размер страницы, ключ строки, выбор.',
    },
    {
      name: 'DataGrid.className',
      type: 'string',
      description: 'Классы внешнего контейнера (поверх встроенных w-full space-y-3).',
    },
    {
      name: 'settings.dataProvider',
      type: '(query: TableQuery) => Promise<TablePage<Row>>',
      description:
        'Обязательный. Получает { filters, pagination: { pageIndex, pageSize }, sorting: { id, desc }[] }, возвращает { rows, total }. Вызывается при монтировании и при каждой смене страницы, фильтра или сортировки. Отказ промиса — блок ошибки с кнопкой «Повторить».',
    },
    {
      name: 'settings.columns',
      type: 'TableColumn<Row>[]',
      description: 'Обязательный. Колонки слева направо, поля колонки — ниже.',
    },
    {
      name: 'settings.pageSize',
      type: 'number',
      default: '10',
      description:
        'Строк на странице. Читается один раз при монтировании; уходит в query.pagination.pageSize.',
    },
    {
      name: 'settings.rowKey',
      type: '(row: Row) => string | number',
      description:
        'Стабильный ключ строки. Без него ключ — номер строки на странице, и выбор переезжает между страницами.',
    },
    {
      name: 'settings.selection',
      type: "'none' | 'single' | 'multiple'",
      default: "'none'",
      description:
        'Колонка выбора: переключатель на строку (single) или флажки с «выбрать все на странице» (multiple).',
    },
    {
      name: 'column.id',
      type: 'string',
      description: 'Обязательный. Уникальный id колонки — ключ в query.filters и query.sorting.',
    },
    {
      name: 'column.header',
      type: 'ReactNode',
      description: 'Обязательный. Заголовок колонки.',
    },
    {
      name: 'column.accessor',
      type: '(row: Row) => ReactNode',
      description: 'Содержимое ячейки: текст, Badge, ссылка. Без него ячейка пустая.',
    },
    {
      name: 'column.sortable',
      type: 'boolean',
      default: 'false',
      description:
        'Сортировка по колонке: значение уходит в query.sorting. Сейчас кнопка сортировки не появляется — см. предупреждение на странице.',
    },
    {
      name: 'column.filterable',
      type: 'boolean',
      default: 'false',
      description:
        'Текстовое поле фильтра над таблицей. Значение уходит в query.filters[id] на каждое нажатие клавиши.',
    },
    {
      name: 'column.filterPlaceholder',
      type: 'string',
      description:
        'Подсказка в поле фильтра. По умолчанию — id колонки. Это единственная подпись поля для скринридера.',
    },
    {
      name: 'column.align',
      type: "'left' | 'center' | 'right'",
      default: "'left'",
      description: 'Выравнивание заголовка и ячеек колонки.',
    },
    {
      name: 'column.className',
      type: 'string',
      description: 'Классы заголовка и ячеек колонки.',
    },
  ],
};
