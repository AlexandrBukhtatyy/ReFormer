import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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
} from './index';

// Обе части рендерятся без Portal → статику можно тестировать целиком через SSR.
// DataGrid: useEffect в SSR не выполняется → status остаётся 'loading', поэтому в разметке
// присутствует только тулбар (вне AsyncBoundary) и LoadingState; сама таблица (ready-ветка) скрыта.

describe('Table (base, презентационный shadcn-набор)', () => {
  it('Table оборачивает <table> в контейнер со скроллом; обе части несут data-slot', () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Ячейка</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(html).toContain('data-slot="table-container"');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('data-slot="table"');
    expect(html).toMatch(/<table/);
  });

  it('каждая под-часть рендерит свой тег и data-slot', () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableCaption>Подпись</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Заголовок</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Значение</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Итого</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
    expect(html).toContain('data-slot="table-caption"');
    expect(html).toContain('data-slot="table-header"');
    expect(html).toContain('data-slot="table-body"');
    expect(html).toContain('data-slot="table-footer"');
    expect(html).toContain('data-slot="table-row"');
    expect(html).toContain('data-slot="table-head"');
    expect(html).toContain('data-slot="table-cell"');
    expect(html).toMatch(/<thead/);
    expect(html).toMatch(/<tbody/);
    expect(html).toMatch(/<tfoot/);
    expect(html).toMatch(/<caption/);
    expect(html).toMatch(/<th/);
    expect(html).toMatch(/<td/);
    expect(html).toMatch(/>Заголовок</);
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Table className="text-base" />);
    expect(html).toContain('text-base');
    expect(html).not.toContain('text-sm');
  });

  it('под-части прокидывают произвольные props (напр. data-testid, colSpan)', () => {
    const html = renderToStaticMarkup(
      <Table data-testid="my-table">
        <TableBody>
          <TableRow>
            <TableCell colSpan={3}>Диапазон</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(html).toContain('data-testid="my-table"');
    expect(html).toMatch(/colSpan="3"/i);
  });
});

describe('DataGrid (data-driven обёртка над Table)', () => {
  const settings: TableSettings<{ id: number; name: string }> = {
    columns: [
      { id: 'name', header: 'Имя', accessor: (r) => r.name, sortable: true },
      { id: 'id', header: 'ID', accessor: (r) => r.id },
    ],
    rowKey: (r) => r.id,
    dataProvider: async () => ({ rows: [], total: 0 }),
  };

  it('на старте (SSR, эффект не выполнен) показывает LoadingState внутри контейнера', () => {
    const html = renderToStaticMarkup(<DataGrid settings={settings} />);
    expect(html).toContain('data-slot="data-grid"');
    // status='loading' → AsyncBoundary рендерит LoadingComponent (LoadingState)
    expect(html).toContain('data-testid="loading-state"');
    expect(html).toContain('role="status"');
    // ready-ветка (сама таблица) при loading отсутствует
    expect(html).not.toContain('data-slot="data-grid-ready"');
    expect(html).not.toContain('data-slot="table"');
  });

  it('прокидывает className на контейнер', () => {
    const html = renderToStaticMarkup(<DataGrid settings={settings} className="mt-4" />);
    expect(html).toContain('mt-4');
  });

  it('тулбар с фильтр-инпутами рендерится вне AsyncBoundary (виден при loading)', () => {
    const filterable: TableSettings<{ id: number; name: string }> = {
      ...settings,
      columns: [
        {
          id: 'name',
          header: 'Имя',
          accessor: (r) => r.name,
          filterable: true,
          filterPlaceholder: 'Поиск по имени',
        },
        { id: 'id', header: 'ID', accessor: (r) => r.id },
      ],
    };
    const html = renderToStaticMarkup(<DataGrid settings={filterable} />);
    expect(html).toContain('data-slot="data-grid-toolbar"');
    expect(html).toContain('data-testid="filter-name"');
    expect(html).toContain('placeholder="Поиск по имени"');
    // фильтр только у колонки name, не у id
    expect(html).not.toContain('data-testid="filter-id"');
  });

  it('без фильтруемых колонок тулбар не рендерится', () => {
    const html = renderToStaticMarkup(<DataGrid settings={settings} />);
    expect(html).not.toContain('data-slot="data-grid-toolbar"');
  });
});
