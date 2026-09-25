# Overview

`@reformer/renderer-react` — рендерер форм для React. Принимает `RenderSchema` (единое декларативное дерево узлов) и отрисовывает компоненты, связывая их с реактивным состоянием формы из `@reformer/core`.

Под архитектурой M1 схема — **одно** дерево `RenderNode`: и layout, и конфиг полей вшиты в него. Лист несёт `value` (сигнал модели, `model.$.x`) + `component` + `componentProps`. По этому же дереву `createReactForm` строит форму и render-схему за один проход, а `FormRenderer` — рендерит полученный бандл.

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

> **Ключевой момент** — сборка идёт ОДНИМ вызовом `createReactForm`, а рендерер принимает её
> результат пропом `form`. Билдер схемы фабрика вызывает ДВАЖДЫ: без формы (по этому дереву
> строятся ноды — harvest не должен встретить `FormProxy`, иначе переполнение стека) и с формой
> (это дерево рендерится, из него wizard берёт `componentProps.form`). Лист-узел резолвит
> state-ноду по сигналу через реестр, который заполняет сборка; без неё реестр пуст — поля
> рендерятся как `null` с warning.

```tsx
import type { FormModel } from '@reformer/core';
import {
  FormRenderer,
  createReactForm,
  useReactForm,
  type RenderNode,
} from '@reformer/renderer-react';
import { Box, Section, Input, FormField } from '@reformer/ui-kit';

interface MyForm {
  email: string;
  password: string;
}

// (1) Построить M1-дерево: листья привязаны к сигналам модели (`model.$.<field>`).
function buildSchema(model: FormModel<MyForm>): RenderNode<MyForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Вход' },
        children: [
          { value: model.$.email, component: Input, componentProps: { label: 'Email' } },
          {
            value: model.$.password,
            component: Input,
            componentProps: { label: 'Пароль', type: 'password' },
          },
        ],
      },
    ],
  };
}

function MyFormPage() {
  // (2) Модель + форма (harvest листьев по сигналу + материализация массивов) + render-схема —
  //     одним вызовом. useReactForm (ленивый useState) зовёт фабрику ровно один раз: useMemo
  //     не годится, React вправе сбросить его кэш и пересобрать форму, потеряв введённое.
  const myForm = useReactForm(() =>
    createReactForm<MyForm>({ initial: { email: '', password: '' }, schema: buildSchema })
  );

  // (3) Бандл целиком уходит рендереру; программное управление — через myForm.render.node(sel).
  return <FormRenderer form={myForm} settings={{ fieldWrapper: FormField }} />;
}
```

### Multi-step forms

Wizard-узел — `FormWizard` из `@reformer/ui-kit/form-wizard`: форма едет в
`componentProps.form`, шаги — в `componentProps.steps` (`{ number, title, icon, body }`, где
`body` — самостоятельный `RenderNode`), а тело шага рисуется ОБЯЗАТЕЛЬНОЙ стратегией
`renderStepBody` — без неё шаг не просто «не отрисуется», а уронит рендер.

Полный рецепт с примером схемы, двойным проходом harvest'а и разбором submit —
[07-form-wizard.md](07-form-wizard.md), он же `find_recipe wizard`.

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
- **Связывание поля и `FieldAdapter`** — лист связывает с моделью сам рендерер: seam (`value` + `onChange(value)` + `onBlur`) переводится в диалект контрола (`checked` + `onCheckedChange`, `value` + `onChange(event)`, `value` + `onChange(value, option)` и т.д.) по `FieldAdapter`. Адаптер берётся из статики компонента `reformerAdapter` (компоненты `@reformer/ui-kit` её уже объявляют — в `component` кладётся сам компонент, «field-версий» нет; свой контрол — `defineFieldControl(C, { adapter })` из `@reformer/ui-kit/fields`). Для чужих компонентов без статики — вторая настройка `settings` рядом с `fieldWrapper`: `resolveFieldAdapter(component)`, она приоритетнее статики. Нет ни того, ни другого → seam применяется как есть. Императивный `FieldHandle` для `schema.node(sel).getRef()` тоже строит рендерер: handle контрола либо базовый handle из его DOM-узла. Рецепт — [05-cookbook.md](05-cookbook.md).
- **`createRenderSchema(fn)`** — превращает `RenderSchemaFn` в `RenderSchemaProxy` для программного управления узлами (`setHidden`, `patchProps`, `getRef`) и точкой подключения декларативного behavior.
- **`RenderBehaviorFn<T>`** — функция `(schema) => void`, применяющая standalone-хелперы (`hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount`) к `RenderSchemaProxy`.

## Components and exports

| Export                                                                           | Purpose                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `createReactForm`, `useReactForm`                                                | Сборка бандла одним вызовом (модель, форма, render-схема). |
| `FormRenderer`                                                                   | Рендер формы. Пропы: `{ form }` (бандл) ЛИБО `{ render }`. |
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
