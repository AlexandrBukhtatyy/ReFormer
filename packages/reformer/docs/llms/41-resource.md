# Загрузка на сигналах — resource

## Purpose

`resource()` из `@reformer/core/resource` грузит данные по реактивному ключу: смена сигналов,
которые читает `key`, запускает новую загрузку, а прежний запрос отменяется через `AbortSignal`.
Ответ устаревшего запроса не применяется, даже если `load` сигнал отмены не слушает.

- Состояние — сигналы `state`, `data`, `status` (`idle | loading | ready | error`), `error`,
  `refreshing`, `isFetching`.
- Несколько смен ключа в одном тике дают один запрос — с последним ключом.
- Ресурс принадлежит текущей области (`createStore`) и снимается вместе с ней.
- На нём стоит серверный режим таблицы (`@reformer/core/table`).

## API

```typescript
resource<T, K = void, E = unknown>({
  key?: () => K | null | undefined, // null/undefined — idle
  load: (key: K, ctx: { signal: AbortSignal; previous: T | undefined }) => Promise<T>,
  enabled?: () => boolean,
  initialData?: T,
  keepPrevious?: boolean, // true: новый ключ — ready + refreshing
  equals?: (a: K, b: K) => boolean, // по умолчанию глубокое
  toError?: (error: unknown) => E,
  onSuccess?: (data: T) => void,
  onError?: (error: E) => void,
}): Resource<T, E>; // + reload, abort, mutate, settled, dispose
```

Машина состояний (`asyncResourceReducer`, `initialAsyncResourceState`, `defaultToError`,
`rejectionMessage`) — та же, что у `AsyncBoundary` в `@reformer/cdk`.

## Examples

### Загрузка по полю модели

```typescript
import { createModel, createStore } from '@reformer/core/model';
import { resource } from '@reformer/core/resource';

const page = createStore(() => {
  const model = createModel({ userId: 0 });
  const user = resource({
    key: () => (model.userId > 0 ? model.userId : null),
    load: (id, { signal }) => fetch(`/api/users/${id}`, { signal }).then((r) => r.json()),
  });
  return { model, user };
});

page.model.userId = 7; // запрос /api/users/7
```

### В компоненте

```tsx
import { useSignalSnapshot, useStore } from '@reformer/core/react';

// Фабрика useStore вызывается один раз: смену `id` ресурс не увидит. Ключ из пропса —
// перемонтированием: <User key={id} id={id} />; ключ из модели — key: () => model.userId.
function User({ id }: { id: number }) {
  const user = useStore(() => resource({ load: () => api.user(id) }));
  const state = useSignalSnapshot(user.state);
  if (state.status === 'loading') return <Spinner />;
  return <p>{state.data?.name}</p>;
}
```

## Anti-patterns

### Своя проверка «ответ устарел»

```typescript
// ❌ флаг cancelled и счётчик запросов вручную
// ✅ resource(): отмена и отсев устаревших ответов уже внутри
```

## See also

- `45-data-table.md` — серверная таблица поверх `resource()`.
- `40-app-state-store.md` — стор приложения.
