// @vitest-environment happy-dom
/**
 * DataGrid как вид над уровнем таблицы (ReFormer-cn5g.5).
 *
 * Режим `table`: грид рисует таблицу из стора приложения — клиентскую над массивом модели. Правка
 * модели (формой, кодом) сразу видна гриду, сортировка и фильтр идут в памяти, видимость колонок
 * задаёт уровень. Режим `settings`: устаревший запрос отменяется через `AbortSignal`.
 *
 * Без глобалов vitest автоочистки testing-library нет — снимаем отрисовку сами (`afterEach`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { arrayOf, createModel, createStore } from '@reformer/core/model';
import { createTable } from '@reformer/core/table';
import { DataGrid, type TableColumn, type TableQuery } from './index';

afterEach(cleanup);

interface User {
  id: number;
  name: string;
  role: string;
}

const USERS: User[] = [
  { id: 1, name: 'Иван', role: 'admin' },
  { id: 2, name: 'анна', role: 'user' },
  { id: 3, name: 'Борис', role: 'user' },
];

const COLUMNS: TableColumn<User>[] = [
  { id: 'name', header: 'Имя', accessor: (u) => u.name },
  { id: 'role', header: 'Роль', accessor: (u) => u.role },
  { id: 'actions', header: 'Действия', accessor: (u) => `#${u.id}` },
];

function usersStore() {
  return createStore(() => {
    const model = createModel({
      users: arrayOf((): User => ({ id: 0, name: '', role: 'user' }), USERS),
    });
    const table = createTable({
      data: model.$.users,
      columns: [
        { id: 'name', sortable: true, filterable: true },
        { id: 'role', sortable: true },
      ],
      getRowKey: (u) => u.id,
      selection: 'multiple',
    });
    return { model, table };
  });
}

const bodyNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]!.textContent);

describe('DataGrid — режим table (клиентская таблица над моделью)', () => {
  it('рисует строки модели, колонка без пары в таблице — всегда', () => {
    const app = usersStore();
    render(<DataGrid table={app.table} columns={COLUMNS} />);
    expect(bodyNames()).toEqual(['Иван', 'анна', 'Борис']);
    expect(screen.getByText('#2')).toBeTruthy();
    app.dispose();
  });

  it('клик по заголовку сортирует в памяти; фильтр тулбара фильтрует', () => {
    const app = usersStore();
    render(<DataGrid table={app.table} columns={COLUMNS} />);
    fireEvent.click(screen.getByRole('button', { name: /Имя/ }));
    expect(bodyNames()).toEqual(['анна', 'Борис', 'Иван']);
    expect(screen.getByRole('columnheader', { name: /Имя/ }).getAttribute('aria-sort')).toBe(
      'ascending'
    );
    // Роль сортируема в уровне, но в тулбаре фильтра у неё нет: фильтр — только у name.
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter: Имя' }), {
      target: { value: 'нн' },
    });
    expect(bodyNames()).toEqual(['анна']);
    app.dispose();
  });

  it('правка модели сразу видна гриду', () => {
    const app = usersStore();
    render(<DataGrid table={app.table} columns={COLUMNS} />);
    act(() => {
      app.model.users.at(0)!.name = 'Игорь';
    });
    expect(bodyNames()[0]).toBe('Игорь');
    act(() => {
      app.model.users.push({ id: 4, name: 'Глеб', role: 'user' });
    });
    expect(bodyNames()).toHaveLength(4);
    app.dispose();
  });

  it('выбор строк и onSelectionChange; «выбрать всё» на странице', () => {
    const app = usersStore();
    const onSelectionChange = vi.fn();
    render(<DataGrid table={app.table} columns={COLUMNS} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1]!);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ keys: ['2'], rows: [USERS[1]] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      keys: ['2', '1', '3'],
      rows: [USERS[1], USERS[0], USERS[2]],
    });
    expect(app.table.selection.allOnPage.value).toBe(true);
    app.dispose();
  });

  it('скрытая уровнем колонка не рисуется', () => {
    const app = usersStore();
    render(<DataGrid table={app.table} columns={COLUMNS} />);
    expect(screen.getByRole('columnheader', { name: 'Роль' })).toBeTruthy();
    act(() => app.table.columns.role.setVisible(false));
    expect(screen.queryByRole('columnheader', { name: 'Роль' })).toBeNull();
    app.dispose();
  });
});

describe('DataGrid — режим settings: отмена устаревших запросов', () => {
  it('переход на другую страницу отменяет идущий запрос', async () => {
    const signals: AbortSignal[] = [];
    const queries: TableQuery[] = [];
    let release: (() => void) | undefined;
    const provider = vi.fn(async (query: TableQuery, ctx: { signal: AbortSignal }) => {
      queries.push(query);
      signals.push(ctx.signal);
      if (query.pagination.pageIndex === 1) await new Promise<void>((r) => (release = r));
      const start = query.pagination.pageIndex * 10;
      return {
        rows: Array.from({ length: 10 }, (_, i) => ({
          id: start + i + 1,
          name: `u-${start + i + 1}`,
          role: 'user',
        })),
        total: 30,
      };
    });
    render(
      <DataGrid
        settings={{
          dataProvider: provider,
          columns: COLUMNS.slice(0, 2),
          rowKey: (u: User) => u.id,
        }}
      />
    );
    await screen.findByText('u-1');
    fireEvent.click(screen.getByRole('link', { name: '2' }));
    await waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('link', { name: '3' }));
    await screen.findByText('u-21');
    expect(signals[1]!.aborted).toBe(true);
    await act(async () => release?.());
    expect(screen.queryByText('u-11')).toBeNull(); // ответ отменённого запроса не применён
    expect(queries.map((q) => q.pagination.pageIndex)).toEqual([0, 1, 2]);
  });

  it('ошибка провайдера — блок ошибки с повтором', async () => {
    let fail = true;
    const provider = vi.fn(async () => {
      if (fail) throw new Error('Сервис недоступен');
      return { rows: USERS, total: USERS.length };
    });
    render(
      <DataGrid
        settings={{ dataProvider: provider, columns: COLUMNS.slice(0, 2), rowKey: (u) => u.id }}
      />
    );
    await screen.findByText('Сервис недоступен');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Retry|Повторить/ }));
    await screen.findByText('Иван');
  });
});
