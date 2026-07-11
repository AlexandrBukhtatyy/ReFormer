---
sidebar_position: 4
---

# Асинхронная предзагрузка

Формы часто нужно наполнить данными с сервера: initial-значения редактируемой сущности и справочники
для селектов. Под M1 есть три инструмента: **initial-значения** в `createModel(...)`, загрузка через
**`model.patch(...)`** после fetch и динамические опции через
**`form.field.updateComponentProps({ options })`**.

## Initial-значения в модели

Начальные значения задаются в `createModel(initial)`. К ним же возвращает `model.reset()`.

```typescript
import { createModel, createForm } from '@reformer/core';
import { Input, Select } from '@reformer/ui-kit';

type ProfileForm = { username: string; language: 'ru' | 'en' };

const model = createModel<ProfileForm>({ username: '', language: 'ru' });

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
};

const form = createForm<ProfileForm>({ model, schema });
```

## Стабильность инстанса

Модель, схему и форму создавайте **один раз** через `useMemo(() => {...}, [])`. Иначе они
пересоздадутся на каждый рендер, а вместе с ними перезапустится и preload.

```tsx
// ❌ пересоздаётся на каждый рендер → preload запускается каждый раз
function BadForm() {
  const model = createModel<ProfileForm>(initial);
  const form = createForm({ model, schema });
}

// ✅ стабильные ссылки
function GoodForm() {
  const { model, form } = useMemo(() => {
    const model = createModel<ProfileForm>(initial);
    return { model, form: createForm({ model, schema: buildSchema(model) }) };
  }, []);
}
```

## Async preload — наполнение модели

Значения с сервера грузите во внешнем хуке и вливайте в модель через `model.patch(...)`. Обязателен
race-guard (флаг `cancelled`): пользователь мог сменить id сущности или размонтировать форму, пока
идёт запрос.

```tsx
import { useEffect, useState } from 'react';
import type { FormModel, FormProxy } from '@reformer/core';

interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export function useLoadProfile(
  model: FormModel<ProfileForm>,
  form: FormProxy<ProfileForm>,
  userId: string | null
): LoadingState {
  const [state, setState] = useState<LoadingState>({ isLoading: !!userId, error: null });

  useEffect(() => {
    if (!userId) {
      setState({ isLoading: false, error: null });
      return;
    }
    let cancelled = false;

    (async () => {
      setState({ isLoading: true, error: null });
      try {
        const [profile, dicts] = await Promise.all([fetchProfile(userId), fetchDictionaries()]);
        if (cancelled) return; // сменили userId / unmount

        // наполняем модель значениями
        model.patch(profile);
        // загруженные данные — новая «точка отсчёта» для reset()
        model.captureInitial();

        // динамические опции — после реактивных эффектов от patch
        queueMicrotask(() => {
          if (cancelled) return;
          form.language.updateComponentProps({ options: dicts.languages });
        });

        setState({ isLoading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({ isLoading: false, error: err instanceof Error ? err.message : 'Ошибка' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]); // model / form стабильны (созданы через useMemo)

  return state;
}
```

:::info Почему `queueMicrotask` для опций
`updateComponentProps` после `patch` оборачивайте в `queueMicrotask`, чтобы реактивные эффекты от
`patch` успели отработать и не пересеклись с обновлением пропсов. Без этого опции в `Select` могут
не появиться.
:::

:::tip `captureInitial` после загрузки
`reset()` возвращает к значениям на момент `createModel`. Чтобы «сброс» возвращал к данным с
сервера — вызовите `model.captureInitial()` сразу после `model.patch(...)`.
:::

## Индикация загрузки

Хук отдаёт `{ isLoading, error }` — используйте их в разметке.

```tsx
function ProfileScreen({ userId }: { userId: string }) {
  const { model, form } = useMemo(() => {
    const model = createModel<ProfileForm>({ username: '', language: 'ru' });
    return { model, form: createForm({ model, schema: buildSchema(model) }) };
  }, []);

  const { isLoading, error } = useLoadProfile(model, form, userId);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <form>
      <FormField control={form.username} />
      <FormField control={form.language} />
    </form>
  );
}
```

## Зависимые опции селекта

Опции, зависящие от другого поля (страна → город, бренд → модель), грузите в behavior через
`onChange` + `updateComponentProps`. `onChange` даёт **debounce** и **AbortSignal** из коробки:
устаревший запрос отменяется при следующей смене значения.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

type AddressForm = { country: string; city: string };

async function fetchCities(country: string, opts?: { signal?: AbortSignal }) {
  const res = await fetch(`/api/cities?country=${encodeURIComponent(country)}`, {
    signal: opts?.signal,
  });
  return res.json();
}

export const addressBehavior = defineFormBehavior<AddressForm>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      // сбросить зависимое поле при смене source
      model.city = '';

      if (!country) {
        form.city.updateComponentProps({ options: [] });
        return;
      }

      // loading-состояние (если компонент поддерживает)
      form.city.updateComponentProps({ loading: true, options: [] });

      try {
        const options = await fetchCities(country, { signal }); // signal отменяет устаревший запрос
        form.city.updateComponentProps({ loading: false, options });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // устаревший запрос — молча выходим
        form.city.updateComponentProps({ loading: false, options: [] });
      }
    },
    { debounce: 300 }
  );
});

const form = createForm<AddressForm>({ model, schema, behavior: addressBehavior });
```

Жизненный цикл:

1. `onChange` подписан на `model.$.country`.
2. Debounce 300 мс — не дёргаем сервер на каждое нажатие.
3. `fetchCities(country, { signal })` — `signal` отменяет устаревший запрос при следующей смене.
4. Результат кладётся в `updateComponentProps({ options })`, `Select` обновляется через сигнал
   `componentProps`.

:::warning Сбрасывайте зависимое поле
При смене source-поля очищайте зависимое значение (`model.city = ''`), иначе останется город,
которого нет в новом списке. `onChange` не срабатывает на инициализации (по умолчанию
`immediate: false`) — для запуска сразу передайте `{ immediate: true }`.
:::

## Дальше

- [Модель данных](../core-concepts/model) — `patch` / `reset` / `captureInitial`.
- [Реакции на изменения](../behaviors/watch) — `onChange`, debounce и AbortSignal.
- [Отправка и сброс](./submit-and-reset) — обратная сторона жизненного цикла.
