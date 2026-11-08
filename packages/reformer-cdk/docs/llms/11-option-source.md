# Option source — ResourceConfig и useResourceOptions

Асинхронный источник вариантов для списочных полей: откуда брать опции, искать ли на сервере,
догружать ли страницы. Один контракт `ResourceConfig` понимают `SelectAsync` и `SelectMulti` из
`@reformer/ui-kit` (проп `resource`), `InputSuggest` (проп `suggestions`) и headless
`useAutocomplete` (см. рецепт Autocomplete). Свой выпадающий список строят на хуке
`useResourceOptions`.

```typescript
import { useResourceOptions, type ResourceConfig } from '@reformer/cdk/option-source';
```

## ResourceConfig

```typescript
interface ResourceConfig<T> {
  type: 'static' | 'preload' | 'partial';
  load: (params?: { search?: string; page?: number; pageSize?: number }) => Promise<{
    items: { id: string | number; label: string; value: T; group?: string }[];
    totalCount: number;
  }>;
  pageSize?: number;
}
```

| `type`    | Загрузка                                   | Поиск                                  | Страницы                          |
| --------- | ------------------------------------------ | -------------------------------------- | --------------------------------- |
| `static`  | один `load({})` при монтировании           | нет                                    | нет                               |
| `preload` | один `load({})` — сервер отдаёт всё        | на клиенте, по подстроке `label`       | нет                               |
| `partial` | `load({ search, page: 1, pageSize })`      | на сервере, с задержкой 300 мс         | `loadMore()` до `totalCount`      |

`value` опции приводится к строке (`NormalizedOption.value`), `id` — ключ опции: при догрузке
страниц повторы по `id` отбрасываются.

## Источник в поле формы

Источник — константа модуля (или значение из `useMemo`): хук перезагружает опции, когда меняется
ссылка на `resource`.

```tsx
import type { FormModel, FormSchemaNode } from '@reformer/core';
import type { ResourceConfig } from '@reformer/cdk/option-source';
import { SelectAsync } from '@reformer/ui-kit';

// Серверный поиск: сервер фильтрует и режет на страницы.
const cityResource: ResourceConfig<string> = {
  type: 'partial',
  pageSize: 20,
  load: async ({ search = '', page = 1, pageSize = 20 } = {}) => {
    const query = new URLSearchParams({ q: search, page: String(page), size: String(pageSize) });
    const res = await fetch(`/api/cities?${query}`);
    const body: { items: { code: string; name: string }[]; total: number } = await res.json();
    return {
      items: body.items.map((c) => ({ id: c.code, label: c.name, value: c.code })),
      totalCount: body.total,
    };
  },
};

const schema = (model: FormModel<{ city: string | null }>): FormSchemaNode => ({
  children: [
    {
      model: model.$.city,
      component: SelectAsync,
      componentProps: { label: 'Город', resource: cityResource },
    },
  ],
});
```

Опции, которые зависят от значения другого поля (регион → города), меняет поведение формы —
рецепт `async-options-loading` в `@reformer/core`.

## useResourceOptions

Хук для своего списка: стратегии, задержка поиска и догрузка — внутри, разметка — ваша.

```tsx
import { isNearBottom, useResourceOptions } from '@reformer/cdk/option-source';

function CityList() {
  const ro = useResourceOptions(cityResource);
  return (
    <div>
      {ro.flags.searchable && (
        <input value={ro.searchInput} onChange={(e) => ro.setSearchInput(e.target.value)} />
      )}
      {ro.loading && <p>Загрузка…</p>}
      {ro.error && <button onClick={ro.reload}>Повторить</button>}
      <ul onScroll={(e) => isNearBottom(e.currentTarget) && ro.loadMore()}>
        {ro.options.map((o) => (
          <li key={o.id}>{o.label}</li>
        ))}
      </ul>
      {ro.loadingMore && <p>Ещё…</p>}
    </div>
  );
}
```

Возвращает `options`, `loading`, `loadingMore`, `error`, `hasMore`, `loadMore()`, `reload()`,
`searchInput`, `setSearchInput(text)` и `flags` — `{ serverSearch, paginated, searchable }` для
текущего `type`. Без `resource` хук ничего не загружает и отдаёт пустой список.

## Чистое ядро

Те же стратегии без React — для тестов и своих обёрток: `resolveStrategyFlags(type)`,
`normalizeItems(items)`, `mergeOptions(prev, next)`, `filterClient(options, query)`,
`resourceReducer(state, action)` и `initialResourceState()`, `hasMore(state)`,
`isNearBottom({ scrollTop, clientHeight, scrollHeight }, threshold?)` (порог по умолчанию — 48 px).

## Anti-patterns

- Объект `resource` прямо в JSX или в теле компонента без `useMemo`: новая ссылка на каждый
  рендер — новая загрузка на каждый рендер.
- `partial`, когда сервер не умеет искать: поиск уйдёт на сервер и вернёт всё. Для полного
  списка, который фильтруют на клиенте, — `preload`.
- `totalCount` меньше реального числа записей: догрузка остановится раньше конца списка.
