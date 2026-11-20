# Уровень таблицы — createTable

## Purpose

`createTable` из `@reformer/core/table` — уровень UI над моделью: сортировка (в том числе по
нескольким колонкам), фильтры, страницы, видимость колонок и выбор строк — сигналами. Строками
владеет модель (клиентский режим) или провайдер (серверный); таблица владеет только состоянием
вида.

- **Клиентский режим** — `data: model.$.users`: фильтр → сортировка → страница на `computed`.
  Правка строки модели (формой, кодом) сразу видна таблице. `row.model` — под-модель строки.
- **Серверный режим** — `dataProvider(query, { signal })` поверх `resource()`: одно действие
  пользователя — один вызов провайдера, устаревший запрос отменяется.
- Новый фильтр и новый размер страницы возвращают на первую страницу; строк стало меньше —
  номер страницы не дальше последней; пропавшие строки уходят из выбора.
- Вид — `<DataGrid table={…} columns={…}>` из `@reformer/ui-kit/table` или своя разметка.

## API

```typescript
createTable({
  columns: [{ id, value?, sortable?, filterable?, compare?, match?, initialFilter?, visible?, meta? }],
  data: model.$.rows | signal | array, // или dataProvider: (query, { signal }) => Promise<{ rows, total }>
  getRowKey?: (row) => string | number,
  pageSize?: number, // 10
  selection?: 'none' | 'single' | 'multiple',
  multiSort?: boolean, // true
  locale?: () => string | undefined, // коллация клиентской сортировки
  state?: { sorting?, filters?, pageIndex?, pageSize?, selected?, hidden? }, // привязка к модели
  enabled?: () => boolean, // серверный режим
});

table.columns.name; // sort, sortIndex, filter, visible, toggleSort({ multi }), setSort, setFilter, setVisible
table.rows; // строки страницы: key, value, model, selected, select, toggle
table.selection; // keys, rows, allOnPage, someOnPage, toggleAllOnPage, clear
table.query; // { filters, pagination, sorting } — ключ загрузки и источник для адреса
```

## Examples

### Клиентская таблица над моделью

```typescript
const app = createStore(() => {
  const model = createModel({ users: arrayOf(blankUser, users) });
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

app.table.columns.name.toggleSort(); // по имени
app.table.columns.name.setFilter('ив'); // и на первую страницу
```

### DataGrid над таблицей

```tsx
<DataGrid
  table={app.table}
  columns={[
    { id: 'name', header: 'Имя', accessor: (u) => u.name },
    { id: 'role', header: 'Роль', accessor: (u) => u.role },
  ]}
/>
```

### Страница таблицы в адресе

```typescript
const pageIndex = signal(Number(new URLSearchParams(location.search).get('page') ?? 0));
const table = createTable({ dataProvider, columns, state: { pageIndex } });
// Страница из адреса не обрезается до первого ответа: число строк ещё неизвестно.
```

## Anti-patterns

### Сброс страницы эффектом после смены фильтра

```typescript
// ❌ watchField(filters, () => table.setPage(0)) — два запроса: с фильтром и со сбросом
// ✅ column.setFilter(value) — фильтр и первая страница в одной записи, один запрос
```

### Копия строк в состоянии таблицы

```typescript
// ❌ createTable({ data: model.users.toArray() }) — снимок, правки модели не видны
// ✅ createTable({ data: model.$.users }) — сигнал массива
```

## Ограничения текущей версии

- Состав колонок фиксируется при создании, как ключи модели.
- Редактирование в таблице — позже, отдельным сабпатом `@reformer/core/table/edit`.
- Клиентский режим пересчитывает снимок массива при правке ячейки — для больших наборов серверный.

## See also

- `41-resource.md`, `46-cross-level-rules.md`.
