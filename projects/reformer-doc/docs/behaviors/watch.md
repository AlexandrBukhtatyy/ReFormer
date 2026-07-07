---
sidebar_position: 5
---

# Реакции на изменения

Побочные эффекты в ответ на изменение поля: загрузка зависимых опций, аналитика, ревалидация.
Основной оператор — `onChange`; низкоуровневый примитив — `watchField`; для перевалидации схемы —
`revalidateWhen`.

## onChange

`onChange(source, cb, { debounce?, immediate? })` вызывает `cb(value, { signal })` при изменении
поля. Колбэк выполняется **вне effect-контекста** — в нём можно безопасно писать сигналы и ноды
(`updateComponentProps` / `reset`) без «Cycle detected». Для async-колбэков вторым аргументом
приходит `{ signal }` (AbortSignal): при следующей смене значения предыдущий вызов аннулируется —
передавай `signal` в `fetch`.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

type AddressForm = { country: string; city: string };

const behavior = defineFormBehavior<AddressForm>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      if (!country) {
        form.city.updateComponentProps({ options: [] });
        return;
      }
      try {
        const cities = await fetchCities(country, { signal }); // отмена устаревших запросов
        form.city.updateComponentProps({ options: cities });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        form.city.updateComponentProps({ options: [] });
      }
    },
    { debounce: 300 } // не дёргать сеть на каждый keystroke
  );
});
```

### Опции

| Опция             | Назначение                                                   |
| ----------------- | ------------------------------------------------------------ |
| `debounce: 300`   | не вызывать колбэк на каждое изменение (300–500 мс для сети) |
| `immediate: true` | вызвать колбэк сразу при регистрации (по умолчанию `false`)  |

`signal` полезен не только для `fetch` — на нём можно чистить любой ресурс при следующей смене
значения:

```typescript
onChange(model.$.livePreview, (enabled, { signal }) => {
  if (!enabled) return;
  const interval = setInterval(refreshPreview, 1000);
  // signal аннулируется на следующем изменении — чистим интервал
  signal.addEventListener('abort', () => clearInterval(interval));
});
```

## watchField

`watchField(source, cb, { immediate? })` из `@reformer/core` — базовая подписка на изменение сигнала
(без debounce и AbortSignal), поверх которой построен `onChange`. Это **примитив**: возвращает
cleanup и вызывается императивно. Для простых синхронных реакций:

```typescript
import { watchField } from '@reformer/core';

// вызывается при каждом изменении (по умолчанию НЕ на инициализации)
const stop = watchField(model.$.country, () => {
  model.city = ''; // сброс зависимого поля
});
// stop() — отписаться
```

:::info onChange vs watchField
`onChange` (DSL) — async-реакции с debounce и AbortSignal внутри `defineFormBehavior`. `watchField`
(примитив) — простая синхронная подписка, когда нужна отписка вручную (например, в `useEffect`).
:::

## revalidateWhen

Под M1 валидация — on-demand (`validateFormModel`). Если правило одного поля зависит от **другого**
поля, изменение этого другого поля само по себе проверку не перезапустит. `revalidateWhen(deps,
revalidate)` вызывает колбэк ревалидации при изменении любой из зависимостей (не на инициализации).

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

type RegistrationForm = { password: string; confirmPassword: string };

const behavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  // при смене password перевалидируем схему — правило confirmPassword перепроверится
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, schema);
  });
});
```

:::warning Триггеры — ДРУГИЕ поля
В `deps` передавай поля, от которых зависит правило, а не само проверяемое поле (оно и так
валидируется при собственном изменении). И убедись, что правило реально читает триггер — это
cross-field `ModelValidator`, читающий `root` (см. [Валидацию](../validation/overview)).
:::

## Дальше

- [Вычисляемые поля](./computed) — `compute` для производных значений (а не ручной `onChange` + запись).
- [Синхронизация полей](./sync) — `copyFrom`, `syncFields`.
- [Валидация](../validation/overview) — `validateFormModel` и cross-field правила.
