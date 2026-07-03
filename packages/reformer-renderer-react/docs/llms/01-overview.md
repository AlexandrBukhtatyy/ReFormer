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

Для многошаговых форм wizard-узел — `FormWizard` из `@reformer/ui-kit/form-wizard`
(канонический shipped-компонент). Форма передаётся ему через `componentProps.form`, а шаги —
через `componentProps.steps`: массив объектов `{ number, title, icon, body }`, где `body` —
это `RenderNode` (поддерево M1-схемы шага). `body` — самостоятельная под-схема, её НЕ нужно
оборачивать в `component: Step` + `children`.

```tsx
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { Box, Input } from '@reformer/ui-kit';

// form нужен ТОЛЬКО рендеру; при createForm дерево строится БЕЗ form.
function buildSchema(model: FormModel<MyForm>, form?: FormProxy<MyForm>): RenderNode<MyForm> {
  const m = model.$;
  return {
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      ...(form ? { form } : {}), // form нужен только рендеру; при createForm его не передаём
      config, // FormWizardConfig: { validateStep?, validateAll? } — см. канон ниже
      steps: [
        {
          number: 1,
          title: 'Кредит',
          icon: '💰',
          body: {
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { value: m.loanAmount, component: Input, componentProps: { label: 'Сумма' } },
              { value: m.loanTerm, component: Input, componentProps: { label: 'Срок' } },
            ],
          },
        },
        // ...остальные шаги
      ],
    },
  };
}
```

**Листья-поля под `componentProps.steps[].body` тоже harvest'ятся.** `createForm({ model, schema })`
обходит дерево key-agnostic и доходит до каждого `{ value: signal }`-листа независимо от
вложенности — включая листья внутри `componentProps.steps[].body`. Поэтому строй схему БЕЗ
`form` (чтобы harvest не обходил `FormProxy`) и передавай `form` только в render-proxy
wizard-узла:

```tsx
const model = createModel<MyForm>({ /* ... */ });
// (1) форма из схемы БЕЗ form — harvest листьев под steps[].body работает как есть
const form = createForm<MyForm>({ model, schema: buildSchema(model) });
// (2) render-схема с тем же деревом, но form передан wizard-узлу для рендера
const schema = createRenderSchema<MyForm>(() => buildSchema(model, form));
```

Полный справочник по `FormWizard` (полиморфный `step.body`, `config` / `FormWizardConfig`,
`FormWizardHandle`, обязательный mounting под `RenderContextProvider` / `<FormRenderer>`) —
`@reformer/ui-kit · docs/llms/07-form-wizard.md`.

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
