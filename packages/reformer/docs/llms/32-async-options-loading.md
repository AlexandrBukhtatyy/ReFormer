## 32. ASYNC OPTIONS LOADING

Для динамической подгрузки опций dropdown'а по значению другого поля (`region` → `city options`,
`carBrand` → `carModel options`) — используй `onChange` из `@reformer/core/behaviors` +
`form.field.updateComponentProps({ options })`. `onChange` даёт debounce и AbortSignal из коробки.

```ts
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

type CityOption = { value: string; label: string };

async function fetchCitiesByRegion(region: string, opts?: { signal?: AbortSignal }): Promise<CityOption[]> {
  const res = await fetch(`/api/cities?region=${encodeURIComponent(region)}`, { signal: opts?.signal });
  return res.json();
}

export const behavior = defineFormBehavior<MyForm>(({ model, form }) => {
  onChange(
    model.$.registrationAddress.region,
    async (region, { signal }) => {
      // сбросить зависимое поле при смене source
      model.registrationAddress.city = '';

      if (!region) {
        form.registrationAddress.city.updateComponentProps({ options: [] });
        return;
      }

      // (опционально) loading-состояние
      form.registrationAddress.city.updateComponentProps({ loading: true, options: [] });

      try {
        const options = await fetchCitiesByRegion(region, { signal }); // отмена устаревших
        form.registrationAddress.city.updateComponentProps({ loading: false, options });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // устаревший запрос — молча выходим
        form.registrationAddress.city.updateComponentProps({ loading: false, options: [] });
      }
    },
    { debounce: 300 }
  );
});
```

### Lifecycle

1. `onChange` подписан на изменения `model.$.region`.
2. Debounce 300 мс (не fetch на каждое нажатие клавиши).
3. Async `fetchCitiesByRegion(region, { signal })` — `signal` отменяет устаревший запрос при
   следующей смене значения (защита от race).
4. Результат — `updateComponentProps({ options })` на target-поле.
5. UI (Select / Combobox) обновляется через сигнал `componentProps`.

### Переиспользуемый оператор

Как в монорепо — собираешь свой оператор поверх `onChange`:

```ts
import { onChange } from '@reformer/core/behaviors';
import type { ReadonlySignal } from '@reformer/core/behaviors';

function loadOptionsOn<TValue, TOption>(
  source: ReadonlySignal<TValue>,
  target: { updateComponentProps(p: Record<string, unknown>): void; reset?: () => void },
  fetcher: (value: TValue, opts?: { signal?: AbortSignal }) => Promise<TOption[]>,
  options: { debounce?: number; resetTarget?: boolean } = {}
): void {
  const { debounce = 300, resetTarget = false } = options;
  onChange(
    source,
    async (value, { signal }) => {
      if (resetTarget) target.reset?.();
      if (!value) { target.updateComponentProps({ options: [] }); return; }
      try {
        const data = await fetcher(value, { signal });
        target.updateComponentProps({ options: data });
      } catch {
        target.updateComponentProps({ options: [] });
      }
    },
    { debounce }
  );
}

// Usage:
loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });
```

### Common patterns

- **Debounce 300–500 мс** — баланс UX и rate-limit.
- **Reset target value** — при смене source очисти зависимое поле (`model.city = ''`), чтобы не
  остался устаревший выбор.
- **Loading state** — `updateComponentProps({ loading: true })` пока идёт fetch (компонент должен поддержать).
- **Cancellation** — `onChange` даёт `{ signal }` (AbortSignal); передавай его в `fetch` и
  игнорируй `AbortError`.

### Initial load (preload at form mount)

Для загрузки опций при инициализации формы — external hook + `model.set` + `updateComponentProps`
(см. [29-async-preload.md](29-async-preload.md)). `onChange` не срабатывает на init (по умолчанию
`immediate: false`); для запуска сразу передай `{ immediate: true }`.

### See also

- [11-async-watchfield.md](11-async-watchfield.md) — общий паттерн `onChange`
- [29-async-preload.md](29-async-preload.md) — preload данных при инициализации
- [31-async-validator-debounce.md](31-async-validator-debounce.md) — async **валидация** (не options)
