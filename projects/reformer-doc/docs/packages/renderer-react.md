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
По этому же дереву `createForm({ model, schema })` строит форму, а `FormRenderer` — рендерит.

## Установка

```bash
npm install @reformer/renderer-react @reformer/core
```

## Быстрый пример

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
import { FormField, Input } from '@reformer/ui-kit';

interface MyForm {
  email: string;
}

// Одно M1-дерево: листья привязаны к сигналам модели (`model.$.<field>`).
function buildSchema(model: ReturnType<typeof createModel<MyForm>>) {
  return {
    children: [{ value: model.$.email, component: Input, componentProps: { label: 'Email' } }],
  };
}

export function MyFormPage() {
  const { schema } = useMemo(() => {
    const model = createModel<MyForm>({ email: '' });
    // createForm строит форму ИЗ той же схемы (harvest листьев по сигналу).
    createForm<MyForm>({ model, schema: buildSchema(model) });
    // Render-схема: тот же билдер или `createRenderSchema`-прокси для behaviors.
    const schema = createRenderSchema<MyForm>(() => buildSchema(model));
    return { schema };
  }, []);

  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

> `FormRenderer` НЕ принимает проп `form`. Форма создаётся из той же M1-схемы через
> `createForm({ model, schema })`, а лист-узел резолвит state-ноду по сигналу через реестр,
> который заполняет `createForm`. Без `createForm` реестр пуст — поля рендерятся как `null`
> с предупреждением.

## Что внутри

- **FormRenderer** — главный React-компонент. Принимает `render` (render-схему) и `settings`,
  обходит дерево `RenderNode` и отрисовывает форму, связывая каждый лист с реактивным
  состоянием модели.
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
