---
sidebar_position: 4
---

# Асинхронная предзагрузка

Формы часто нужно наполнить данными с сервера: значения редактируемой сущности и справочники для
селектов. Инструменты: **начальные значения** модели, загрузка через **`model.patch(...)`** после
запроса и динамические опции через **`form.field.updateComponentProps({ options })`**.

## Начальные значения в модели

Начальные значения задаются при создании модели — `createModel(initial)` или `initial` сборки. К ним
же возвращает `model.reset()`.

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { Input, SelectAsync } from '@reformer/ui-kit';

type ProfileForm = { username: string; language: 'ru' | 'en' };

const profileSchema = (model: FormModel<ProfileForm>): FormSchemaNode => ({
  children: [
    { model: model.$.username, component: Input, componentProps: { label: 'Username' } },
    {
      model: model.$.language,
      component: SelectAsync,
      componentProps: {
        label: 'Язык',
        options: [
          { value: 'ru', label: 'Русский' },
          { value: 'en', label: 'English' },
        ],
      },
    },
  ],
});

export const createProfileForm = () =>
  createForm<ProfileForm>({ initial: { username: '', language: 'ru' }, schema: profileSchema });
```

## Стабильность сборки

Сборку создавайте **один раз** хуком `useFormBundle(factory)` из `@reformer/core/react`. Иначе
модель и форма пересоздадутся на каждый рендер, а вместе с ними перезапустится и загрузка.

```tsx
import { useFormBundle } from '@reformer/core/react';

// ❌ пересоздаётся на каждый рендер → загрузка запускается каждый раз
function BadForm() {
  const bundle = createProfileForm();
}

// ✅ одна сборка на всё время жизни компонента
function GoodForm() {
  const bundle = useFormBundle(createProfileForm);
}
```

## Загрузка значений — `AsyncBoundary`

Загрузку удобно отдать `AsyncBoundary` (`@reformer/ui-kit` или headless-версия из `@reformer/cdk`):
он ведёт статус (`loading` / `error` / `ready`), отменяет устаревший запрос при смене `loadKey` и
размонтировании и даёт «Повторить» из коробки. Форме остаётся одно — записать ответ в модель.

```tsx
import { useFormBundle } from '@reformer/core/react';
import { AsyncBoundary, FormField } from '@reformer/ui-kit';
import type { FormBundle } from '@reformer/core';

interface ProfileData {
  profile: Partial<ProfileForm>;
  languages: { value: string; label: string }[];
}

async function loadProfile(userId: string, signal: AbortSignal): Promise<ProfileData> {
  const [profile, dictionaries] = await Promise.all([
    fetchProfile(userId, { signal }),
    fetchDictionaries({ signal }),
  ]);
  return { profile, languages: dictionaries.languages };
}

/** Ответ сервера → модель и поля формы. */
function applyProfile({ model, form }: FormBundle<ProfileForm>, data: ProfileData) {
  model.patch(data.profile); // только пришедшие ключи
  model.captureInitial(); // загруженное — новая точка отсчёта для model.reset()
  // справочники — следующим тактом, после реактивных эффектов от patch
  queueMicrotask(() => form.language.updateComponentProps({ options: data.languages }));
}

export function ProfileScreen({ userId }: { userId: string | null }) {
  const bundle = useFormBundle(createProfileForm);

  return (
    <AsyncBoundary<ProfileData>
      load={(signal) => loadProfile(userId!, signal)}
      loadKey={userId}
      enabled={userId !== null} // нет id — форма создания, грузить нечего
      onSuccess={(data) => applyProfile(bundle, data)}
    >
      <FormField control={bundle.form.username} />
      <FormField control={bundle.form.language} />
    </AsyncBoundary>
  );
}
```

`model.patch(partial)` обновляет только переданные ключи: вложенные группы сливаются, массивы
заменяются целиком. Полная запись — `model.set(value)`: ей нужны все ключи (в dev недостающие
выводятся предупреждением, их значения не трогаются).

:::info Почему `queueMicrotask` для опций
`updateComponentProps` после `patch` оборачивайте в `queueMicrotask`: реактивные эффекты от `patch`
(например, перестроение строк массива) успевают отработать, и опции попадают в уже готовые поля.
:::

:::tip `captureInitial` после загрузки
`model.reset()` возвращает к снимку модели. Чтобы «сброс» возвращал к данным с сервера, вызовите
`model.captureInitial()` сразу после `model.patch(...)`. Подробнее — в
[Отправке и сбросе](./submit-and-reset#сброс-формы).
:::

Если форму рисует рендерер по схеме, загрузка записывается правилом узла в поведении формы:
`onMount(schema.node('data-boundary'), …)` загружает данные, а `schema.node(…).patchProps({ status })`
передаёт статус узлу `AsyncBoundary` в controlled-режиме.

## Своя загрузка без `AsyncBoundary`

Если нужен свой хук, обязателен race-guard: пользователь мог сменить id сущности или размонтировать
форму, пока идёт запрос. Его даёт `AbortController` эффекта.

```tsx
import { useEffect, useState } from 'react';

export function useLoadProfile(bundle: FormBundle<ProfileForm>, userId: string | null) {
  const [state, setState] = useState({ isLoading: userId !== null, error: null as string | null });

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    setState({ isLoading: true, error: null });

    loadProfile(userId, controller.signal)
      .then((data) => {
        applyProfile(bundle, data);
        setState({ isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return; // сменили userId / размонтировали
        setState({ isLoading: false, error: error instanceof Error ? error.message : 'Ошибка' });
      });

    return () => controller.abort();
  }, [bundle, userId]); // bundle стабилен — собран через useFormBundle

  return state;
}
```

## Зависимые опции селекта

Опции, зависящие от другого поля (страна → город, бренд → модель), грузите в поведении через
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
      // сбросить зависимое поле при смене источника
      model.city = '';

      if (!country) {
        form.city.updateComponentProps({ options: [] });
        return;
      }

      // состояние загрузки (если компонент его поддерживает)
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

createForm<AddressForm>({ initial, schema: addressSchema, behavior: addressBehavior });
```

Жизненный цикл:

1. `onChange` подписан на `model.$.country`.
2. Debounce 300 мс — не дёргаем сервер на каждое нажатие.
3. `fetchCities(country, { signal })` — `signal` отменяет устаревший запрос при следующей смене.
4. Результат кладётся в `updateComponentProps({ options })`, `Select` обновляется через сигнал
   `componentProps`.

:::warning Сбрасывайте зависимое поле
При смене поля-источника очищайте зависимое значение (`model.city = ''`), иначе останется город,
которого нет в новом списке. `onChange` не срабатывает на инициализации (по умолчанию
`immediate: false`) — для запуска сразу передайте `{ immediate: true }`.
:::

## Дальше

- [Модель данных](../core-concepts/model) — `patch` / `set` / `reset` / `captureInitial`.
- [Реакции на изменения](../behaviors/watch) — `onChange`, debounce и AbortSignal.
- [Отправка и сброс](./submit-and-reset) — обратная сторона жизненного цикла.
