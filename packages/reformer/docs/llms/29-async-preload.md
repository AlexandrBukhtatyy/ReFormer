# Async Preload — Загрузка начальных значений и справочников

## Purpose

Загрузка формы данными с сервера под M1: (1) **initial values** в `createModel(...)`; (2)
**`model.set` / `model.patch`** для загрузки/обновления значений; (3) **external React-hook**
для full-blown async preload (параллельный fetch заявки + справочников, обработка ошибок,
race-guard через deps). Динамические `componentProps` (опции селектов) обновляются через
`form.field.updateComponentProps({ options })` в `queueMicrotask`, чтобы не пересечься с
реактивными эффектами от `set`/`patch`.

## API

```typescript
// Модель:
model.set(value: T): void;            // полная установка значений (load полного DTO). Не меняет initial.
model.patch(value: Partial<T>): void; // частичное слияние (только переданные ключи). Не меняет initial.
model.reset(): void;                  // вернуть к initial-снимку
model.captureInitial(): void;         // сделать текущие значения новым initial-снимком

// Нода поля/группы:
form.field.updateComponentProps(props: Record<string, unknown>): void; // динамические опции и т.п.
```

Initial values задаются в `createModel(initial)`; `reset()` возвращает к ним. Чтобы загруженные
данные стали новой «точкой отсчёта» для `reset()` — вызови `model.captureInitial()` после load.

## Examples

### Initial values в модели

```typescript
import { createModel, createForm } from '@reformer/core';
import { Input, Select } from '@reformer/ui-kit';

type ProfileForm = { username: string; language: 'ru' | 'en'; marketing: boolean };

const model = createModel<ProfileForm>({ username: '', language: 'ru', marketing: true });
const schema = {
  username: { value: model.$.username, component: Input, componentProps: { label: 'Username' } },
  language: {
    value: model.$.language,
    component: Select,
    componentProps: {
      label: 'Язык',
      options: [
        { value: 'ru', label: 'Русский' },
        { value: 'en', label: 'English' },
      ],
    },
  },
  marketing: { value: model.$.marketing, component: Input, componentProps: { type: 'checkbox' } },
};
const form = createForm({ model, schema });
// model.get() === { username: '', language: 'ru', marketing: true }
// после правок: model.reset() возвращает к этим значениям
```

### Async preload через external hook + model.set

```tsx
import { useEffect, useState } from 'react';
import type { FormModel, FormProxy } from '@reformer/core';

interface LoadingState { isLoading: boolean; error: string | null }

export function useLoadCreditApplication(
  model: FormModel<CreditApplicationForm>,
  form: FormProxy<CreditApplicationForm>,
  applicationId: string | null
): LoadingState {
  const [state, setState] = useState<LoadingState>({ isLoading: !!applicationId, error: null });

  useEffect(() => {
    if (!applicationId) { setState({ isLoading: false, error: null }); return; }
    let cancelled = false;

    (async () => {
      setState({ isLoading: true, error: null });
      try {
        const [appResp, dictsResp] = await Promise.all([
          fetchCreditApplication(applicationId),
          fetchDictionaries(),
        ]);
        if (cancelled) return; // race-guard: сменили applicationId / unmount
        if (appResp.status !== 200 || dictsResp.status !== 200) throw new Error('Сервер вернул ошибку');

        // Загрузка значений в модель
        model.set(appResp.data);

        // Динамические componentProps — через queueMicrotask (после реактивных эффектов от set)
        queueMicrotask(() => {
          if (cancelled) return;
          form.registrationAddress.city.updateComponentProps({ options: dictsResp.data.cities });
        });

        setState({ isLoading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({ isLoading: false, error: err instanceof Error ? err.message : 'Ошибка' });
      }
    })();

    return () => { cancelled = true; };
  }, [applicationId]); // model/form стабильны (создан через useMemo)

  return state;
}
```

### Preload через behavior — onChange на поле

Загрузка справочника при выборе другого поля (после preload) — через `onChange`:

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

export const addressBehavior = defineFormBehavior<AddressForm>(({ model, form }) => {
  onChange(
    model.$.region,
    async (region, { signal }) => {
      if (!region) { form.city.updateComponentProps({ options: [] }); return; }
      try {
        const cities = await fetchCities(region, { signal });
        form.city.updateComponentProps({ options: cities });
      } catch {
        form.city.updateComponentProps({ options: [] });
      }
    },
    { debounce: 300 }
  );
});
```

## Anti-patterns

```typescript
// ❌ model/form пересоздаются на каждый рендер → preload запускается каждый раз
function MyForm() {
  const model = createModel<T>(initial);   // КАЖДЫЙ рендер!
  const form = createForm({ model, schema });
}

// ✅ Стабильные ссылки через useMemo
function MyForm() {
  const { model, form } = useMemo(() => {
    const m = createModel<T>(initial);
    return { model: m, form: createForm({ model: m, schema: buildSchema(m) }) };
  }, []);
}
```

```typescript
// ❌ updateComponentProps синхронно после set → возможный конфликт с реактивными эффектами
model.set(data);
form.region.updateComponentProps({ options: [...] });

// ✅ queueMicrotask, чтобы реактивные эффекты от set завершились
model.set(data);
queueMicrotask(() => form.region.updateComponentProps({ options: [...] }));
```

```typescript
// ❌ Нет race-guard в async useEffect
useEffect(() => { fetchData(id).then((d) => model.set(d)); }, [id]);

// ✅ Cleanup-флаг
useEffect(() => {
  let cancelled = false;
  fetchData(id).then((d) => { if (!cancelled) model.set(d); });
  return () => { cancelled = true; };
}, [id]);
```

## Troubleshooting

**Q: После `set`/`patch` не показываются ошибки.**
A: `set`/`patch` не запускают валидацию. После загрузки вызови `await validateFormModel(model, schema)`.

**Q: Опции в `<Select>` не появляются после `updateComponentProps`.**
A: (1) Оберни вызов в `queueMicrotask`; (2) убедись, что компонент подписан через `useFormControl`;
(3) для массивов — пройдись по элементам (`form.items.map`) и обнови каждый.

**Q: При `reset()` теряются данные с сервера.**
A: `reset()` возвращает к initial-снимку из `createModel`, не к последнему `set`. Чтобы «сбросить
к данным с сервера» — после `set` вызови `model.captureInitial()` (новая точка отсчёта).

## See also

- [28-submit-and-reset.md](./28-submit-and-reset.md) — обратная сторона жизненного цикла
- [11-async-watchfield.md](./11-async-watchfield.md) — `onChange` для динамики после preload
- [22-cycle-detection.md](./22-cycle-detection.md) — почему `queueMicrotask` нужен
- [16-ui-components.md](./16-ui-components.md) — `updateComponentProps` для динамических опций
