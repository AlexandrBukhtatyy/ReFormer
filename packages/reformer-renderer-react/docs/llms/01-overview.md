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
              { value: model.$.loanAmount, component: Input, componentProps: { label: 'Сумма' } },
              { value: model.$.loanTerm, component: Input, componentProps: { label: 'Срок' } },
            ],
          },
        },
        // ...остальные шаги
      ],
    },
  };
}
```

**Листья-поля под `componentProps.steps[].body` тоже harvest'ятся.** Сборка обходит дерево
key-agnostic и доходит до каждого `{ value: signal }`-листа независимо от вложенности — включая
листья внутри `componentProps.steps[].body`. Отсюда двойной проход, и делает его фабрика:

```tsx
const myForm = useReactForm(() =>
  createReactForm<MyForm>({ model: createMyModel(), schema: buildSchema })
);
// внутри: buildSchema(model) — дерево БЕЗ формы для harvest'а (FormProxy самоссылочен, обход по
// нему упал бы с переполнением стека), затем buildSchema(model, form) — дерево для рендера, из
// которого wizard-узел берёт форму. Писать эту пару руками больше не нужно.
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
- **`resolveFieldAdapter` / `FieldAdapter`** — вторая настройка `settings` (рядом с `fieldWrapper`): по компоненту поля (`node.component`) резолвит адаптер, который переводит value-based seam рендерера (`value` + `onChange(value)`) в диалект сырого контрола (`checked` + `onChange(event)`, `value` + `onChange(value, option)`, `value` + `onChange(event)` и т.д.). Позволяет регистрировать СЫРЫЕ контролы любого UI-kit, не оборачивая каждый; нет адаптера → seam применяется как есть (обратная совместимость, текущее поведение). Рецепт — [05-cookbook.md](05-cookbook.md).
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
