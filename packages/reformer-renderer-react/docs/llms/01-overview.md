# Overview

`@reformer/renderer-react` — рендерер форм для React. Принимает `RenderSchema` (единое декларативное дерево узлов) и отрисовывает компоненты, связывая их с реактивным состоянием формы из `@reformer/core`.

Под архитектурой M1 схема — **одно** дерево `RenderNode`: и layout, и конфиг полей вшиты в него. Лист несёт `value` (сигнал модели, `model.$.x`) + `component` + `componentProps`. По этому же дереву `createForm({ model, schema })` строит форму, а `FormRenderer` — рендерит.

## Installation

```bash
npm install @reformer/renderer-react @reformer/core react react-dom
```

## Import Patterns

```typescript
// recommended
import {
  FormRenderer,
  createRenderSchema,
  hideWhen,
  renderEffect,
  onComponentEvent,
  type RenderSchemaFn,
  type RenderNode,
} from '@reformer/renderer-react';
```

## Quick Start

> **Ключевой момент** — `FormRenderer` НЕ принимает проп `form`. Форма создаётся из той же
> M1-схемы (`createForm({ model, schema })`) и передаётся wizard/root-узлу через его
> `componentProps.form`. Лист-узел резолвит state-ноду по сигналу через реестр, который
> заполняет `createForm`. Без `createForm` реестр пуст — поля рендерятся как `null` с warning.

```tsx
import { useMemo } from 'react';
import { createForm, type FormModel } from '@reformer/core';
import {
  FormRenderer,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import { Box, Section, Input, FormField } from '@reformer/ui-kit';

interface MyForm {
  email: string;
  password: string;
}

// (1) Построить M1-дерево: листья привязаны к сигналам модели (`model.$.<field>`).
function buildSchema(model: FormModel<MyForm>): RenderNode<MyForm> {
  const m = model.$;
  return {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Вход' },
        children: [
          { value: m.email, component: Input, componentProps: { label: 'Email' } },
          {
            value: m.password,
            component: Input,
            componentProps: { label: 'Пароль', type: 'password' },
          },
        ],
      },
    ],
  };
}

function MyFormPage() {
  // (2) createForm({ model, schema }) — строит форму ИЗ той же схемы
  //     (harvest листьев по сигналу + материализация массивов).
  const { form, model } = useMemo(() => {
    const model = createModel<MyForm>({ email: '', password: '' }); // ваша фабрика модели
    const form = createForm<MyForm>({ model, schema: buildSchema(model) });
    return { form, model };
  }, []);

  // (3) Render-схема (то же дерево). Для программного управления — createRenderSchema.
  const schema = useMemo(() => createRenderSchema<MyForm>(() => buildSchema(model)), [model]);

  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

### Multi-step forms

Для многошаговых форм корневой узел — `RendererFormWizard` (compat-shim над `FormWizard` из
`@reformer/ui-kit/form-wizard`), которому передаётся `form` через `componentProps`, а шаги —
через `componentProps.steps` (массив `RenderNode`, каждый с `component: Step`). Форма для
wizard-узла добавляется в схему при её сборке. Каноническая схема wizard-узла:

```tsx
// упрощённо
function buildSchema(model, form?) {
  return {
    selector: 'wizard',
    component: RendererFormWizard,
    componentProps: {
      ...(form ? { form } : {}), // form нужен только рендеру; при createForm его не передаём
      steps: [
        { component: Step, componentProps: { title: 'Шаг 1' }, children: [ /* поля */ ] },
        // ...
      ],
    },
  };
}
```

### Container `children` — top-level свойство

`children` контейнера задаётся на самом узле, НЕ внутри `componentProps`. Рендерер
деструктурирует `const { children } = node`:

```typescript
// CORRECT
{ component: Section, componentProps: { title: 'X' }, children: [ /* nodes */ ] }

// WRONG — children в componentProps игнорируется, поддерево не рендерится
{ component: Section, componentProps: { title: 'X', children: [ /* nodes */ ] } }
```

## Key Concepts

- **`RenderSchemaFn<T>`** — `() => RenderNode<T>`. Возвращает корневой узел дерева. Аргумента-пути нет: привязка к данным идёт через сигналы модели в листьях.
- **`RenderNode<T>`** — узел дерева, дискриминированный union: **field** (`ModelFieldRenderNode` — есть `value: Signal`), **array** (`ArrayRenderNode` — есть `array` + `item`), **container** (`ContainerRenderNode` — есть `component` + `children`).
- **`fieldWrapper`** — общая обёртка вокруг каждого поля (label, error). Передаётся через `settings`. Можно перекрыть для конкретного поля через `componentProps.fieldWrapper`.
- **`createRenderSchema(fn)`** — превращает `RenderSchemaFn` в `RenderSchemaProxy` для программного управления узлами (`setHidden`, `patchProps`, `getRef`) и точкой подключения декларативного behavior.
- **`RenderBehaviorFn<T>`** — функция `(schema) => void`, применяющая standalone-хелперы (`hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount`) к `RenderSchemaProxy`.

## Components and exports

| Export                                                                           | Purpose                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `FormRenderer`                                                                   | Главный React-компонент, отрисовывающий форму по схеме.    |
| `RenderNodeComponent`                                                            | Рекурсивный рендер одного узла (для ручной композиции).    |
| `RenderModelNode`, `RenderModelArray`                                            | Низкоуровневый рендер узла/массива M1-схемы.               |
| `RenderContextProvider`, `useRenderContext`                                      | Контекст рендеринга: `form`, `settings`.                   |
| `createRenderSchema`, `isRenderSchemaProxy`                                      | Программное управление схемой.                             |
| `isModelFieldRenderNode`, `isArrayRenderNode`, `isContainerRenderNode`           | Type guards для `RenderNode`.                              |
| `hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount` | Декларативные behavior-хелперы.                            |

## See also

- [02-render-schema.md](02-render-schema.md) — формат `RenderSchemaFn`, `RenderNode`, массивы.
- [03-render-behavior.md](03-render-behavior.md) — hideWhen, renderEffect, lifecycle.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
- [05-cookbook.md](05-cookbook.md) — рецепты из реального кода.
