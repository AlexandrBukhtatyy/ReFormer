---
id: renderer-react
title: '@reformer/renderer-react'
sidebar_label: 'renderer-react'
---

# @reformer/renderer-react

> Рендерер: декларативная схема + реактивная модель → React-дерево формы.

`@reformer/renderer-react` берёт декларативную render-схему (единое дерево `RenderNode`) и
реактивную модель из `@reformer/core` и разворачивает их в React-дерево формы. Каждый лист
привязывается к сигналу модели (`model.$.<field>`) и к своему компоненту, а состояние
валидации автоматически маршрутизируется в UI — без ручного проброса `value`/`onChange`.

В отличие от ручного JSX с `FormField`, где разметку и привязку каждого поля пишут руками,
здесь форма описывается **как данные**: одно дерево узлов задаёт и layout, и конфиг полей.
По этому же дереву `createReactForm` строит модель, форму и render-схему за один проход, а
`FormRenderer` — рендерит полученный бандл.

## Установка

```bash
npm install @reformer/renderer-react @reformer/core
```

## Быстрый пример

```tsx
import type { FormModel } from '@reformer/core';
import { FormRenderer, createReactForm, useReactForm } from '@reformer/renderer-react';
import { FormField, Input } from '@reformer/ui-kit';

interface MyForm {
  email: string;
}

// Одно M1-дерево: листья привязаны к сигналам модели (`model.$.<field>`).
function buildSchema(model: FormModel<MyForm>) {
  return {
    children: [{ value: model.$.email, component: Input, componentProps: { label: 'Email' } }],
  };
}

export function MyFormPage() {
  // Модель + форма + render-схема одним вызовом. useReactForm (ленивый useState) зовёт фабрику
  // ровно один раз — useMemo не годится: React вправе сбросить кэш и потерять введённое.
  const myForm = useReactForm(() =>
    createReactForm<MyForm>({ initial: { email: '' }, schema: buildSchema })
  );

  return <FormRenderer form={myForm} settings={{ fieldWrapper: FormField }} />;
}
```

> Билдер схемы фабрика вызывает дважды: без формы — по этому дереву строятся ноды (обход не должен
> встретить `FormProxy`), и с формой — это дерево рендерится, из него wizard-узел берёт
> `componentProps.form`. Лист-узел резолвит state-ноду по сигналу через реестр, который заполняет
> сборка; без неё реестр пуст — поля рендерятся как `null` с предупреждением.

## Что внутри

- **createReactForm / useReactForm** — сборка формы одним вызовом: `{ initial | model, schema,
behavior?, validation?, renderBehavior?, seed?, setup? }` → бандл `{ model, form, render,
validation? }`. `useReactForm` (тот же `useFormBundle` из core) держит бандл стабильным и армит
  живую валидацию.
- **FormRenderer** — главный React-компонент. Принимает бандл пропом `form` (или низкоуровневый
  `render`) плюс `settings`, обходит дерево `RenderNode` и отрисовывает форму, связывая каждый лист
  с реактивным состоянием модели.
- **createRenderSchema / RenderSchemaFn** — `RenderSchemaFn<T>` это `() => RenderNode<T>`,
  возвращающая корневой узел; привязка к данным идёт через сигналы модели в листьях (аргумента-пути
  нет). `createRenderSchema(fn)` оборачивает её в `RenderSchemaProxy` для программного управления
  узлами (`setHidden`, `patchProps`, `getRef`) и подключения декларативных behaviors.
- **Render behaviors** — standalone-хелперы, применяемые к `RenderSchemaProxy`: `hideWhen`
  (условное скрытие узла), `renderEffect` (реактивный сайд-эффект на рендер), `onComponentEvent`
  (реакция на событие компонента), `onInit`, `onMount`, `onUnmount` (lifecycle-хуки узла).
- **settings.fieldWrapper** — подключаемая обёртка вокруг каждого поля (label + control + error).
  Задаётся глобально через `settings` и может быть перекрыта для конкретного поля через
  `componentProps.fieldWrapper`.

## Дальше

- [@reformer/renderer-json](./renderer-json) — та же форма из JSON
- [Core API Reference](../api)
