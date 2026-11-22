/**
 * Уровень таблицы, клиентский режим [ReFormer-cn5g.4].
 *
 * Строками владеет модель приложения, таблица — только состоянием вида. Проверяется цепочка
 * «фильтр → сортировка → страница», правила (первая страница при новом фильтре, номер страницы не
 * дальше последней, выбор без пропавших строк), выбор в трёх режимах, видимость колонок, привязка
 * состояния к модели и главное свойство уровня: правка строки модели (формой, кодом) сразу видна
 * таблице без клея.
 */

import { describe, expect, it } from 'vitest';
import { computed, signal } from '@preact/signals-core';
import { arrayOf, createModel, createStore } from '../../src/model/index';
import { createTable, type SortEntry } from '../../src/table/index';

type User = { id: number; name: string; role: string; age: number | null };

const USERS: User[] = [
  { id: 1, name: 'Иван', role: 'admin', age: 30 },
  { id: 2, name: 'анна', role: 'user', age: 25 },
  { id: 3, name: 'Борис', role: 'user', age: null },
  { id: 4, name: 'вера', role: 'admin', age: 41 },
  { id: 5, name: 'Глеб', role: 'user', age: 19 },
];

const COLUMNS = [
  { id: 'name', sortable: true, filterable: true },
  { id: 'role', sortable: true, filterable: true },
  { id: 'age', sortable: true },
] as const;

function usersTable(
  extra: Partial<Parameters<typeof createTable<User, 'name' | 'role' | 'age'>>[0]> = {}
) {
  return createTable<User, 'name' | 'role' | 'age'>({
    data: USERS,
    columns: COLUMNS,
    getRowKey: (u) => u.id,
    ...extra,
  } as Parameters<typeof createTable<User, 'name' | 'role' | 'age'>>[0]);
}

const names = (t: { rows: { value: readonly { value: User }[] } }) =>
  t.rows.value.map((r) => r.value.name);

describe('createTable (client) — сортировка', () => {
  it('toggleSort: по возрастанию → по убыванию → без сортировки; коллация без учёта регистра', () => {
    const t = usersTable();
    expect(t.mode).toBe('client');
    expect(t.status.value).toBe('ready');
    expect(names(t)).toEqual(['Иван', 'анна', 'Борис', 'вера', 'Глеб']);
    t.columns.name.toggleSort();
    expect(t.columns.name.sort.value).toBe('asc');
    expect(names(t)).toEqual(['анна', 'Борис', 'вера', 'Глеб', 'Иван']);
    t.columns.name.toggleSort();
    expect(t.columns.name.sort.value).toBe('desc');
    expect(names(t)).toEqual(['Иван', 'Глеб', 'вера', 'Борис', 'анна']);
    t.columns.name.toggleSort();
    expect(t.columns.name.sort.value).toBeNull();
    expect(t.sorting.value).toEqual([]);
    t.dispose();
  });

  it('числа по величине, пустые — больше всех', () => {
    const t = usersTable();
    t.columns.age.setSort('asc');
    expect(t.rows.value.map((r) => r.value.age)).toEqual([19, 25, 30, 41, null]);
    t.dispose();
  });

  it('несколько колонок: multi добавляет, порядок — приоритет; без multi — только одна', () => {
    const t = usersTable();
    t.columns.role.toggleSort();
    t.columns.name.toggleSort({ multi: true });
    expect(t.sorting.value).toEqual([
      { id: 'role', desc: false },
      { id: 'name', desc: false },
    ]);
    expect(t.columns.name.sortIndex.value).toBe(1);
    expect(names(t)).toEqual(['вера', 'Иван', 'анна', 'Борис', 'Глеб']);
    t.columns.role.toggleSort({ multi: true }); // role → desc на своём месте
    expect(t.sorting.value[0]).toEqual({ id: 'role', desc: true });
    t.columns.role.setSort(null, { multi: true });
    expect(t.sorting.value).toEqual([{ id: 'name', desc: false }]);
    t.columns.age.toggleSort();
    expect(t.sorting.value).toEqual([{ id: 'age', desc: false }]);
    expect(t.columns.name.sortIndex.value).toBe(-1);
    t.dispose();
  });

  it('multiSort: false — multi игнорируется', () => {
    const t = usersTable({ multiSort: false });
    t.columns.role.toggleSort();
    t.columns.name.toggleSort({ multi: true });
    expect(t.sorting.value).toEqual([{ id: 'name', desc: false }]);
    t.dispose();
  });

  it('несортируемая колонка команды сортировки игнорирует; setSorting — целиком', () => {
    const t = createTable<User, 'name' | 'role'>({
      data: USERS,
      columns: [{ id: 'name' }, { id: 'role', sortable: true }],
    });
    t.columns.name.toggleSort();
    expect(t.sorting.value).toEqual([]);
    const sorting: SortEntry[] = [{ id: 'role', desc: true }];
    t.setSorting(sorting);
    expect(t.sorting.value).toEqual(sorting);
    expect(t.sorting.value).not.toBe(sorting);
    t.dispose();
  });

  it('своё сравнение и значение колонки; сортировка по неизвестной колонке пропускается', () => {
    const t = createTable<User, 'len'>({
      data: USERS,
      columns: [
        {
          id: 'len',
          sortable: true,
          value: (u) => u.name.length,
          compare: (a, b) => (b as number) - (a as number),
        },
      ],
      state: { sorting: signal<readonly SortEntry[]>([{ id: 'нет', desc: false }]) },
    });
    expect(names(t)).toEqual(['Иван', 'анна', 'Борис', 'вера', 'Глеб']);
    t.columns.len.setSort('asc');
    expect(t.rows.value[0]!.value.name).toBe('Борис');
    t.dispose();
  });

  it('язык коллации — реактивно: смена языка пересортирует', () => {
    const lang = signal('en');
    const t = createTable<{ w: string }, 'w'>({
      data: [{ w: 'ä' }, { w: 'z' }, { w: 'a' }],
      columns: [{ id: 'w', sortable: true }],
      locale: () => lang.value,
    });
    t.columns.w.setSort('asc');
    expect(t.rows.value.map((r) => r.value.w)).toEqual(['a', 'ä', 'z']);
    lang.value = 'sv'; // в шведском ä — после z
    expect(t.rows.value.map((r) => r.value.w)).toEqual(['a', 'z', 'ä']);
    t.dispose();
  });
});

describe('createTable (client) — фильтры и страницы', () => {
  it('строковый фильтр — подстрока без учёта регистра; фильтр возвращает на первую страницу', () => {
    const t = usersTable({ pageSize: 2 });
    t.nextPage();
    expect(t.pageIndex.value).toBe(1);
    t.columns.name.setFilter('А');
    expect(t.pageIndex.value).toBe(0);
    expect(t.filters.value).toEqual({ name: 'А' });
    expect(t.columns.name.filter.value).toBe('А');
    expect(names(t)).toEqual(['Иван', 'анна']); // первая страница из трёх совпадений
    expect(t.total.value).toBe(3);
    t.columns.name.setFilter('');
    expect(t.filters.value).toEqual({});
    t.dispose();
  });

  it('фильтр списком и равенством; нефильтруемая колонка команды игнорирует; повтор — no-op', () => {
    const t = createTable<User, 'role' | 'age' | 'name'>({
      data: USERS,
      columns: [{ id: 'role', filterable: true }, { id: 'age', filterable: true }, { id: 'name' }],
    });
    t.columns.role.setFilter(['admin']);
    expect(t.total.value).toBe(2);
    t.columns.role.clearFilter();
    t.columns.age.setFilter(25);
    expect(names(t)).toEqual(['анна']);
    const before = t.filters.value;
    t.columns.age.setFilter(25);
    expect(t.filters.value).toBe(before);
    t.columns.name.setFilter('x');
    expect(t.filters.value).toEqual({ age: 25 });
    t.columns.age.clearFilter();
    t.columns.age.clearFilter();
    expect(t.filters.value).toEqual({});
    t.dispose();
  });

  it('своя проверка фильтра и initialFilter; фильтр неизвестной колонки пропускается', () => {
    const t = createTable<User, 'age'>({
      data: USERS,
      columns: [
        {
          id: 'age',
          filterable: true,
          initialFilter: 30,
          match: (v, f) => ((v as number | null) ?? 0) >= (f as number),
        },
      ],
      state: { filters: signal({ нет: 'x', age: 30 }) },
    });
    expect(t.total.value).toBe(2);
    t.dispose();
    const initial = createTable<User, 'age'>({
      data: USERS,
      columns: [{ id: 'age', filterable: true, initialFilter: 41 }],
    });
    expect(initial.filters.value).toEqual({ age: 41 });
    expect(initial.total.value).toBe(1);
    initial.dispose();
  });

  it('страницы: setPage ограничен, next/prev на краях — no-op, setPageSize — на первую', () => {
    const t = usersTable({ pageSize: 2 });
    expect(t.pageCount.value).toBe(3);
    t.setPage(10);
    expect(t.pageIndex.value).toBe(2);
    expect(names(t)).toEqual(['Глеб']);
    t.nextPage();
    expect(t.pageIndex.value).toBe(2);
    t.setPage(-3);
    expect(t.pageIndex.value).toBe(0);
    t.prevPage();
    expect(t.pageIndex.value).toBe(0);
    t.nextPage();
    t.setPageSize(4);
    expect(t.pageIndex.value).toBe(0);
    expect(t.pageCount.value).toBe(2);
    t.clearFilters();
    expect(t.pageIndex.value).toBe(0);
    t.dispose();
  });

  it('query — запрос страницы для адреса', () => {
    const t = usersTable({ pageSize: 2 });
    t.columns.role.toggleSort();
    t.columns.name.setFilter('а');
    expect(t.query.value).toEqual({
      filters: { name: 'а' },
      pagination: { pageIndex: 0, pageSize: 2 },
      sorting: [{ id: 'role', desc: false }],
    });
    t.dispose();
  });

  it('R1/R2 для внешних записей: фильтр в поле модели — первая страница; строк меньше — последняя', () => {
    const app = createStore(() => {
      const model = createModel({
        users: arrayOf(() => ({ id: 0, name: '', role: '', age: null as number | null }), USERS),
      });
      const filters = signal<Record<string, unknown>>({});
      const pageIndex = signal(2);
      const table = createTable<User, 'name' | 'role' | 'age'>({
        data: model.$.users,
        columns: COLUMNS,
        getRowKey: (u) => u.id,
        pageSize: 2,
        state: { filters, pageIndex },
      });
      return { model, table, filters, pageIndex };
    });
    expect(app.pageIndex.value).toBe(2);
    app.filters.value = { role: 'user' }; // внешняя запись
    expect(app.pageIndex.value).toBe(0);
    app.table.setPage(1);
    app.model.users.removeAt(4); // осталось 2 user → одна страница
    expect(app.pageIndex.value).toBe(0);
    app.dispose();
  });

  it('привязанная страница за пределами — сразу на последнюю', () => {
    const pageIndex = signal(99);
    const t = usersTable({ pageSize: 2, state: { pageIndex } });
    expect(pageIndex.value).toBe(2);
    t.dispose();
  });
});

describe('createTable (client) — массив модели', () => {
  it('row.model — под-модель строки; правка модели сразу видна таблице (пересортировка)', () => {
    const app = createStore(() => {
      const model = createModel({
        users: arrayOf(() => ({ id: 0, name: '', role: '', age: null as number | null }), USERS),
      });
      const table = createTable({ data: model.$.users, columns: COLUMNS });
      return { model, table };
    });
    app.table.columns.name.toggleSort();
    const first = app.table.rows.value[0]!;
    expect(first.value.name).toBe('анна');
    expect(first.model!.name).toBe('анна');
    first.model!.name = 'Яна'; // запись в модель — как из формы
    expect(names(app.table)).toEqual(['Борис', 'вера', 'Глеб', 'Иван', 'Яна']);
    app.dispose();
  });

  it('без getRowKey ключ — ключ под-модели: стабилен при move', () => {
    const app = createStore(() => {
      const model = createModel({
        users: arrayOf(() => ({ id: 0, name: '', role: '', age: null as number | null }), USERS),
      });
      const table = createTable({ data: model.$.users, columns: COLUMNS, selection: 'multiple' });
      return { model, table };
    });
    const ivan = app.table.rows.value[0]!;
    ivan.select();
    app.model.users.move(0, 3);
    const moved = app.table.rows.value[3]!;
    expect(moved.key).toBe(ivan.key);
    expect(moved.selected.value).toBe(true);
    app.dispose();
  });

  it('массив примитивов модели — без под-модели, ключ — индекс', () => {
    const app = createStore(() => {
      const model = createModel({ tags: ['b', 'a'] });
      const table = createTable<string, 'v'>({
        data: model.$.tags,
        columns: [{ id: 'v', sortable: true, value: (s) => s }],
      });
      return { model, table };
    });
    expect(app.table.rows.value.map((r) => [r.key, r.model])).toEqual([
      ['0', undefined],
      ['1', undefined],
    ]);
    app.dispose();
  });

  it('сигнал массива — строки следуют за ним', () => {
    const data = signal<readonly User[]>(USERS.slice(0, 2));
    const t = createTable<User, 'name'>({ data, columns: [{ id: 'name' }] });
    expect(t.total.value).toBe(2);
    data.value = USERS;
    expect(t.total.value).toBe(5);
    t.dispose();
  });
});

describe('createTable (client) — выбор', () => {
  it("'multiple': select/toggle, строки с других страниц, R3 убирает пропавшие строки", () => {
    const data = signal<readonly User[]>(USERS);
    const t = createTable<User, 'name'>({
      data,
      columns: [{ id: 'name', filterable: true }],
      getRowKey: (u) => u.id,
      pageSize: 2,
      selection: 'multiple',
    });
    t.rows.value[0]!.select();
    t.rows.value[1]!.toggle();
    t.nextPage();
    t.rows.value[0]!.select();
    t.rows.value[0]!.select(); // повтор — no-op
    expect([...t.selection.keys.value]).toEqual(['1', '2', '3']);
    expect(t.selection.rows.value.map((u) => u.id)).toEqual([1, 2, 3]);
    t.columns.name.setFilter('глеб'); // фильтр выбор не трогает
    expect(t.selection.keys.value.size).toBe(3);
    data.value = USERS.filter((u) => u.id !== 2); // строка пропала из данных
    expect([...t.selection.keys.value]).toEqual(['1', '3']);
    t.rows.value[0]!.toggle(); // строки нет в выборе — toggle выбирает
    expect(t.rows.value[0]!.selected.value).toBe(true);
    t.rows.value[0]!.select(false); // снять выбор одной строки
    expect(t.rows.value[0]!.selected.value).toBe(false);
    t.selection.clear();
    expect(t.selection.keys.value.size).toBe(0);
    t.selection.clear(); // пустой — no-op
    t.dispose();
  });

  it('toggleAllOnPage, allOnPage и someOnPage', () => {
    const t = usersTable({ pageSize: 2, selection: 'multiple' });
    expect(t.selection.allOnPage.value).toBe(false);
    t.rows.value[0]!.select();
    expect(t.selection.someOnPage.value).toBe(true);
    t.selection.toggleAllOnPage();
    expect(t.selection.allOnPage.value).toBe(true);
    expect(t.selection.someOnPage.value).toBe(false);
    t.selection.toggleAllOnPage();
    expect(t.selection.keys.value.size).toBe(0);
    t.dispose();
  });

  it('пустая страница: allOnPage false, toggleAllOnPage — no-op', () => {
    const t = createTable<User, 'name'>({
      data: [],
      columns: [{ id: 'name' }],
      selection: 'multiple',
    });
    t.selection.toggleAllOnPage();
    expect(t.selection.allOnPage.value).toBe(false);
    expect(t.pageCount.value).toBe(1);
    t.dispose();
  });

  it("'single': выбор — только одна строка; снятие; toggleAllOnPage не работает", () => {
    const t = usersTable({ selection: 'single' });
    const [a, b] = t.rows.value;
    a!.select();
    b!.select();
    expect([...t.selection.keys.value]).toEqual(['2']);
    b!.select(); // уже единственная — no-op
    b!.select(false);
    expect(t.selection.keys.value.size).toBe(0);
    b!.select(false);
    t.selection.toggleAllOnPage();
    expect(t.selection.keys.value.size).toBe(0);
    t.dispose();
  });

  it("'none' (по умолчанию): выбор не меняется", () => {
    const t = usersTable();
    expect(t.selection.mode).toBe('none');
    t.rows.value[0]!.select();
    expect(t.rows.value[0]!.selected.value).toBe(false);
    t.dispose();
  });

  it('привязанный выбор: ключи не со страницы и неизвестные — rows их пропускает', () => {
    const selected = signal<ReadonlySet<string>>(new Set(['5', '99']));
    const t = usersTable({ pageSize: 2, selection: 'multiple', state: { selected } });
    expect(t.selection.rows.value.map((u) => u.id)).toEqual([5]);
    t.dispose();
  });
});

describe('createTable (client) — колонки и строки', () => {
  it('видимость колонок: visible: false на старте, setVisible, повтор — no-op', () => {
    const t = createTable<User, 'name' | 'role' | 'age'>({
      data: USERS,
      columns: [
        { id: 'name' },
        { id: 'role', visible: false },
        { id: 'age', meta: { align: 'right' } },
      ],
    });
    expect(t.visibleColumns.value).toEqual(['name', 'age']);
    expect(t.columns.role.visible.value).toBe(false);
    t.columns.role.setVisible(true);
    t.columns.role.setVisible(true);
    t.columns.name.setVisible(false);
    expect(t.visibleColumns.value).toEqual(['role', 'age']);
    expect(t.columns.age.meta).toEqual({ align: 'right' });
    expect(Object.isFrozen(t.columns)).toBe(true);
    t.dispose();
  });

  it('лица строк стабильны, пока строка та же; row(key) — строка страницы', () => {
    const t = usersTable({ pageSize: 2 });
    const first = t.rows.value[0]!;
    t.columns.name.setFilter('');
    expect(t.rows.value[0]).toBe(first);
    expect(t.row('2')!.value.name).toBe('анна');
    expect(t.row('5')).toBeUndefined();
    t.reload(); // клиентский режим — no-op
    expect(t.error.value).toBeNull();
    expect(t.refreshing.value).toBe(false);
    t.dispose();
  });

  it('строки без getRowKey и без модели — ключ индекс', () => {
    const t = createTable<User, 'name'>({ data: USERS, columns: [{ id: 'name' }] });
    expect(t.rows.value.map((r) => r.key)).toEqual(['0', '1', '2', '3', '4']);
    t.dispose();
  });

  it('computed над таблицей пересчитывается по смене состояния', () => {
    const t = usersTable();
    const top = computed(() => t.rows.value[0]?.value.name);
    t.columns.name.setSort('desc');
    expect(top.value).toBe('Иван');
    t.dispose();
  });
});
