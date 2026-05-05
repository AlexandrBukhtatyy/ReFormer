## 32. ASYNC OPTIONS LOADING

Для динамической подгрузки опций dropdown'а в зависимости от значения другого поля
(например: `region` → `city options`, `carBrand` → `carModel options`) — используй
`watchField` + `updateComponentProps({ options })`:

```ts
import { watchField } from '@reformer/core/behaviors';
import type { BehaviorSchemaFn } from '@reformer/core';

type CityOption = { value: string; label: string };

async function fetchCitiesByRegion(region: string): Promise<CityOption[]> {
  const res = await fetch(`/api/cities?region=${encodeURIComponent(region)}`);
  return res.json();
}

const behavior: BehaviorSchemaFn<MyForm> = (path) => {
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      if (!region) {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        ctx.form.registrationAddress.city.setValue('');
        return;
      }

      // Set loading state (optional — UI показывает spinner)
      ctx.form.registrationAddress.city.updateComponentProps({
        loading: true,
        options: [],
      });

      try {
        const options = await fetchCitiesByRegion(region);
        ctx.form.registrationAddress.city.updateComponentProps({
          loading: false,
          options,
        });
      } catch {
        ctx.form.registrationAddress.city.updateComponentProps({
          loading: false,
          options: [],
        });
        // optionally — set error на поле через setError
      }
    },
    { debounce: 300 }
  );
};
```

### Lifecycle

1. `watchField` подписан на изменения `path.region`
2. На каждое изменение — debounce 300ms (чтобы не fetch на каждое нажатие клавиши)
3. После debounce — async `fetchCitiesByRegion(region)`
4. Результат — `updateComponentProps({ options })` на target поле
5. UI (Select / Combobox) автоматически обновится через signal на componentProps

### Common patterns

- **Debounce 300-500ms** — баланс между UX и rate-limit
- **Reset target value** — при смене source очисти `setValue('')` чтобы не остался stale выбор
- **Loading state** — `componentProps.loading: true` пока fetch идёт (UI компонент должен это поддержать)
- **Cancellation** — ReFormer **не** отменяет старый fetch автоматически. Если предыдущий fetch ещё идёт, а пришло новое значение — новый запустится параллельно. Может приводить к race. Workaround: использовать `AbortController` через closure:
  ```ts
  let abortController: AbortController | null = null;
  watchField(path.region, async (region, ctx) => {
    abortController?.abort();
    abortController = new AbortController();
    try {
      const opts = await fetchCities(region, { signal: abortController.signal });
      ctx.form.city.updateComponentProps({ options: opts });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      throw e;
    }
  });
  ```

### Initial load (preload at form mount)

Для preload опций при инициализации формы — используй `async-preload` recipe (см. [29-async-preload.md](29-async-preload.md)). Не `watchField` — он не triggers на init.

### See also

- [11-async-watchfield.md](11-async-watchfield.md) — общий паттерн async в `watchField`
- [29-async-preload.md](29-async-preload.md) — preload данных при инициализации
- [31-async-validator-debounce.md](31-async-validator-debounce.md) — для async **валидации** (не options)
