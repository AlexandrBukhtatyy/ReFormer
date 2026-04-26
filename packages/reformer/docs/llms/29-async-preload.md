# Async Preload — Загрузка начальных значений и динамических справочников

## Purpose

Раздел про загрузку формы данными с сервера: (1) **initial values** в схеме (для дефолтов и mock-данных без API); (2) **patchValue** для частичного обновления существующей формы; (3) **external React-hook** (`useLoadCreditApplication`) для full-blown async preload — параллельный fetch заявки + справочников, обработка ошибок, race-condition guard через `applicationId` в deps. Динамические `componentProps` (опции селектов и т. п.) обновляются через `queueMicrotask`, чтобы не пересечься с реактивными эффектами от `patchValue`.

## API

```typescript
// FormProxy / GroupNode:

interface PreloadAPI<T> {
  /** Полная замена value. Перетирает всё. */
  setValue(value: T): void;

  /** Частичный мердж. Не трогает поля, отсутствующие в payload. Используется для preload. */
  patchValue(value: Partial<T>): void;

  /** Initial values из схемы. reset() возвращает к ним. */
  reset(): void;

  /** Динамическое обновление componentProps конкретного поля. */
  field.updateComponentProps(props: Record<string, unknown>): void;
}
```

В схеме `FormSchema<T>` каждое поле принимает `value: TFieldValue` — это initial value, в которое поле возвращается при `reset()`.

## Examples

### Initial values в схеме

```typescript
import { createForm, type FormSchema } from '@reformer/core';
import { Input, Select } from '@reformer/ui-kit';

interface ProfileForm {
  username: string;
  language: 'ru' | 'en';
  marketing: boolean;
}

const schema: FormSchema<ProfileForm> = {
  username: {
    value: '',                // initial
    component: Input,
    componentProps: { label: 'Username' },
  },
  language: {
    value: 'ru',              // дефолт «Русский»
    component: Select,
    componentProps: {
      label: 'Язык',
      options: [
        { value: 'ru', label: 'Русский' },
        { value: 'en', label: 'English' },
      ],
    },
  },
  marketing: {
    value: true,
    component: Input,
    componentProps: { type: 'checkbox' },
  },
};

const form = createForm({ form: schema });
// form.getValue() === { username: '', language: 'ru', marketing: true }
// после правок: form.reset() возвращает к этим же значениям
```

### Async preload через external hook + patchValue

```tsx
import { useEffect, useState } from 'react';
import type { FormProxy } from '@reformer/core';

interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export function useLoadCreditApplication(
  form: FormProxy<CreditApplicationForm>,
  applicationId: string | null,
): LoadingState {
  const [state, setState] = useState<LoadingState>({
    isLoading: !!applicationId,
    error: null,
  });

  useEffect(() => {
    if (!applicationId) {
      setState({ isLoading: false, error: null });
      return;
    }

    let cancelled = false;

    (async () => {
      setState({ isLoading: true, error: null });

      try {
        const [appResp, dictsResp] = await Promise.all([
          fetchCreditApplication(applicationId),
          fetchDictionaries(),
        ]);

        // Race-guard: пользователь успел сменить applicationId или unmount
        if (cancelled) return;

        if (appResp.status !== 200 || dictsResp.status !== 200) {
          throw new Error('Сервер вернул ошибку');
        }

        // patchValue для полей формы
        form.patchValue(appResp.data);

        // Динамические componentProps — через queueMicrotask, чтобы дождаться
        // окончания реактивных эффектов от patchValue
        queueMicrotask(() => {
          if (cancelled) return;
          form.registrationAddress.city.updateComponentProps({
            options: dictsResp.data.cities,
          });
          form.properties?.forEach((prop) =>
            prop.type.updateComponentProps({ options: dictsResp.data.propertyTypes }),
          );
        });

        setState({ isLoading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          isLoading: false,
          error: err instanceof Error ? err.message : 'Неизвестная ошибка',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId]); // form стабилен (создан через useMemo)

  return state;
}
```

Source: `useLoadCreditApplication.ts` (monorepo example).

### Использование hook'а в компоненте

```tsx
import { useMemo } from 'react';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { isLoading, error } = useLoadCreditApplication(form, '1'); // ID заявки

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => location.reload()} />;

  return <FormWizard form={form} steps={STEPS} onSubmit={onSubmit} />;
}
```

Source: `CreditApplicationForm.tsx:50-66` (monorepo example).

### Preload через behavior (когда сервер отвечает на изменение поля)

```typescript
import { watchField, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface AddressForm {
  region: string;
  city: string;
}

export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  // Загрузка списка городов при выборе региона
  watchField(
    path.region,
    async (region, ctx) => {
      if (!region) {
        ctx.form.city.updateComponentProps({ options: [] });
        return;
      }

      try {
        const { data: cities } = await fetchCities(region);
        ctx.form.city.updateComponentProps({ options: cities });
      } catch (err) {
        console.error('Failed to load cities:', err);
        ctx.form.city.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 },
  );
};
```

Source: `address-behavior.ts` (monorepo example).

## Anti-patterns

```typescript
// ❌ form пересоздаётся при каждом рендере → preload запускается каждый раз
function MyForm() {
  const form = createForm({ form: schema }); // КАЖДЫЙ рендер!
  useLoadCreditApplication(form, '1');
  return …;
}

// ✅ Стабильная ссылка через useMemo
function MyForm() {
  const form = useMemo(() => createForm({ form: schema }), []);
  useLoadCreditApplication(form, '1');
  return …;
}
```

```typescript
// ❌ updateComponentProps синхронно после patchValue → "Cycle detected"
form.patchValue(data);
form.region.updateComponentProps({ options: [...] }); // bang

// ✅ queueMicrotask, чтобы реактивные эффекты от patchValue завершились
form.patchValue(data);
queueMicrotask(() => {
  form.region.updateComponentProps({ options: [...] });
});
```

```typescript
// ❌ Полная замена через setValue вместо patchValue
form.setValue(partialData); // partialData может не содержать все поля → перетирает в undefined

// ✅ patchValue — partial update, сохраняет необъявленные поля
form.patchValue(partialData);
```

```typescript
// ❌ Отсутствие race-guard в async useEffect
useEffect(() => {
  fetchData(id).then((data) => form.patchValue(data));
}, [id]);
// Если id быстро поменялся, старый response перезапишет новый

// ✅ Cleanup-флаг
useEffect(() => {
  let cancelled = false;
  fetchData(id).then((data) => {
    if (!cancelled) form.patchValue(data);
  });
  return () => { cancelled = true; };
}, [id]);
```

```typescript
// ❌ Initial values задаются через patchValue после createForm — reset() их не помнит
const form = createForm({ form: schema });
form.patchValue({ username: 'default' });
form.reset(); // username станет '' (из schema), а не 'default'

// ✅ Если значение должно быть initial, кладите его в schema.value
const schema = { username: { value: 'default', component: Input } };
```

## Troubleshooting

**Q: После `patchValue` ошибки валидации не показываются.**
A: `patchValue` НЕ trigger'ит `markAsTouched`. Если хотите сразу видеть ошибки — после `patchValue` вызовите `form.markAsTouched(); await form.validate();`.

**Q: Опции в `<Select>` не появляются после `updateComponentProps`.**
A: (1) Убедитесь, что вызов обёрнут в `queueMicrotask` после patch'ей; (2) проверьте, что компонент Select подписан на изменения через `useFormControl` (не использует props напрямую без подписки); (3) для FormArray — пройдитесь `forEach` по элементам и обновите для каждого.

**Q: `form.patchValue` не работает для FormArray.**
A: Работает, но требует, чтобы массив существовал. Если в schema у вас `arr: { value: [] }`, `patchValue({ arr: [item1, item2] })` создаст элементы. Опции внутри элементов придётся обновить через `forEach` отдельно (см. example).

**Q: Двойной запрос при mount + StrictMode.**
A: StrictMode вызывает effect дважды. Race-guard через `cancelled` флаг (см. пример) корректно отменяет первый запрос. Дополнительно проверьте, что `applicationId` стабилен между рендерами.

**Q: Хочу прелоад без отдельного hook'а — прямо в behavior через `watchField` на `id`.**
A: Можно, но behavior запускается в момент создания формы и не может вернуть loading state. Лучше использовать external hook + `patchValue`. Behavior подходит для динамики **после** preload (загрузка городов при смене региона и т. п.).

**Q: При `reset()` теряются данные, загруженные с сервера.**
A: Это by design — `reset()` возвращает к initial values из schema, не к последнему `patchValue`. Если нужно «сбросить к данным с сервера», храните snapshot и используйте `form.setValue(snapshot)` вместо `reset()`.

## See also

- [28-submit-and-reset.md](./28-submit-and-reset.md) — обратная сторона жизненного цикла
- [11-async-watchfield.md](./11-async-watchfield.md) — `watchField` для динамики после preload
- [22-cycle-detection.md](./22-cycle-detection.md) — почему `queueMicrotask` нужен
- [16-ui-components.md](./16-ui-components.md) — `updateComponentProps` для динамических опций
