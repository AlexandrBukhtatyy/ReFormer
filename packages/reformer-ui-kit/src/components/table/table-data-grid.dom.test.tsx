// @vitest-environment happy-dom
/**
 * DataGrid в DOM: то, что SSR-тест (`table.test.tsx`) не видит, — данные из `dataProvider`,
 * клики и состояние между запросами (ReFormer-6od).
 *
 * Без глобалов vitest автоочистки testing-library нет — снимаем отрисовку сами (`afterEach`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DataGrid, type TableQuery, type TableSettings } from './index';

afterEach(cleanup);

interface User {
  id: number;
  name: string;
}

const USERS: User[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `user-${i + 1}` }));

/** Провайдер «как сервер»: фильтр по имени и страница из `query`; запросы — в `calls`. */
function serverProvider() {
  const calls: TableQuery[] = [];
  const provider = vi.fn(async (query: TableQuery) => {
    calls.push(query);
    const needle = String(query.filters.name ?? '');
    const matched = USERS.filter((u) => u.name.includes(needle));
    const { pageIndex, pageSize } = query.pagination;
    return {
      rows: matched.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
      total: matched.length,
    };
  });
  return { provider, calls };
}

const baseSettings = (overrides: Partial<TableSettings<User>> = {}): TableSettings<User> => ({
  columns: [
    { id: 'name', header: 'Имя', accessor: (u) => u.name, sortable: true, filterable: true },
    { id: 'id', header: 'ID', accessor: (u) => u.id },
  ],
  pageSize: 10,
  rowKey: (u) => u.id,
  dataProvider: serverProvider().provider,
  ...overrides,
});

const lastCall = (calls: TableQuery[]): TableQuery => calls[calls.length - 1];

describe('DataGrid — сортировка', () => {
  it('клик по заголовку сортируемой колонки уходит в dataProvider и ставит aria-sort', async () => {
    const { provider, calls } = serverProvider();
    render(<DataGrid settings={baseSettings({ dataProvider: provider })} />);
    await screen.findByText('user-1');

    const nameHeader = screen.getByRole('columnheader', { name: /Имя/ });
    expect(nameHeader.getAttribute('aria-sort')).toBeNull();

    // Было: у колонок не было accessorFn → getCanSort() ложно → кнопки сортировки нет вовсе.
    fireEvent.click(screen.getByRole('button', { name: /Имя/ }));
    await waitFor(() => expect(lastCall(calls).sorting).toEqual([{ id: 'name', desc: false }]));
    await waitFor(() => expect(nameHeader.getAttribute('aria-sort')).toBe('ascending'));

    fireEvent.click(screen.getByRole('button', { name: /Имя/ }));
    await waitFor(() => expect(lastCall(calls).sorting).toEqual([{ id: 'name', desc: true }]));
    await waitFor(() => expect(nameHeader.getAttribute('aria-sort')).toBe('descending'));

    // Несортируемая колонка aria-sort не получает.
    expect(screen.getByRole('columnheader', { name: 'ID' }).getAttribute('aria-sort')).toBeNull();
  });

  it('перезагрузка не размонтирует таблицу: фокус остаётся на кнопке сортировки', async () => {
    let release: () => void = () => {};
    const provider = vi.fn(async (query: TableQuery) => {
      if (query.sorting.length > 0) await new Promise<void>((resolve) => (release = resolve));
      return { rows: USERS.slice(0, 10), total: USERS.length };
    });
    render(<DataGrid settings={baseSettings({ dataProvider: provider })} />);
    await screen.findByText('user-1');

    const sortButton = screen.getByRole('button', { name: /Имя/ });
    sortButton.focus();
    fireEvent.click(sortButton);
    await waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

    // Запрос ещё идёт: таблица на месте, регион помечен занятым, фокус не потерян.
    expect(screen.getByRole('table')).toBeTruthy();
    expect(sortButton.isConnected).toBe(true);
    expect(document.activeElement).toBe(sortButton);
    expect(document.querySelector('[data-slot="async-boundary"]')?.getAttribute('aria-busy')).toBe(
      'true'
    );

    await act(async () => release());
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="async-boundary"]')?.getAttribute('aria-busy')
      ).toBeNull()
    );
  });
});

describe('DataGrid — фильтр и пагинация', () => {
  it('фильтр подписан для скринридера', async () => {
    render(<DataGrid settings={baseSettings()} />);
    expect(screen.getByRole('textbox', { name: 'Filter: Имя' })).toBeTruthy();
  });

  it('смена фильтра возвращает на первую страницу', async () => {
    const { provider, calls } = serverProvider();
    render(<DataGrid settings={baseSettings({ dataProvider: provider })} />);
    await screen.findByText('user-1');

    fireEvent.click(screen.getByRole('link', { name: '3' }));
    await screen.findByText('user-21');
    expect(lastCall(calls).pagination.pageIndex).toBe(2);

    // Было: страница оставалась 3-й, а под фильтром «user-1» строк на неё не хватает — «Нет данных».
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter: Имя' }), {
      target: { value: 'user-1' },
    });
    await waitFor(() =>
      expect(lastCall(calls)).toMatchObject({
        filters: { name: 'user-1' },
        pagination: { pageIndex: 0 },
      })
    );
    await screen.findByText('user-10');
    expect(screen.queryByText('No data')).toBeNull();
  });

  it('новый pageSize из настроек перезапрашивает данные с первой страницы', async () => {
    const { provider, calls } = serverProvider();
    const { rerender } = render(<DataGrid settings={baseSettings({ dataProvider: provider })} />);
    await screen.findByText('user-1');
    fireEvent.click(screen.getByRole('link', { name: '2' }));
    await screen.findByText('user-11');

    rerender(<DataGrid settings={baseSettings({ dataProvider: provider, pageSize: 5 })} />);
    await waitFor(() => expect(lastCall(calls).pagination).toEqual({ pageIndex: 0, pageSize: 5 }));
  });
});

describe('DataGrid — выделение', () => {
  it('onSelectionChange отдаёт ключи и строки, в том числе выбранные на другой странице', async () => {
    const onSelectionChange = vi.fn();
    render(<DataGrid settings={baseSettings({ selection: 'multiple', onSelectionChange })} />);
    await screen.findByText('user-1');

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenLastCalledWith({ keys: ['1'], rows: [USERS[0]] })
    );

    fireEvent.click(screen.getByRole('link', { name: '2' }));
    await screen.findByText('user-11');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenLastCalledWith({
        keys: ['1', '11'],
        rows: [USERS[0], USERS[10]],
      })
    );
  });

  it('без rowKey выбор не переезжает на строку с тем же индексом другой страницы', async () => {
    const onSelectionChange = vi.fn();
    render(
      <DataGrid
        settings={baseSettings({ rowKey: undefined, selection: 'multiple', onSelectionChange })}
      />
    );
    await screen.findByText('user-1');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenLastCalledWith({ keys: ['0'], rows: [USERS[0]] })
    );

    fireEvent.click(screen.getByRole('link', { name: '2' }));
    await screen.findByText('user-11');

    const boxes = screen.getAllByRole('checkbox', { name: 'Select row' }) as HTMLInputElement[];
    expect(boxes.some((box) => box.checked)).toBe(false);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ keys: [], rows: [] });
  });

  it('single: радио строк — одна группа (общий name)', async () => {
    render(<DataGrid settings={baseSettings({ selection: 'single' })} />);
    await screen.findByText('user-1');

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(10);
    const names = new Set(radios.map((radio) => radio.name));
    expect(names.size).toBe(1);
    expect([...names][0]).not.toBe('');
  });
});
