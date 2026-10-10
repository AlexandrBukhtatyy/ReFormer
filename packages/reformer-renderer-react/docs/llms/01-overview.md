# Overview

`@reformer/renderer-react` — рендерер форм для React. Рисует схему формы (единое декларативное дерево узлов) и связывает компоненты с реактивным состоянием формы из `@reformer/core`.

Схема — **одно** дерево узлов: и layout, и конфиг полей вшиты в него. Лист несёт `model` (ручку модели, `model.$.x`) + `component` + `componentProps`. По этому дереву единая сборка `createForm` из `@reformer/core` строит форму, компилирует схему (`bundle.render.tree`) и уровень формы (проверка, отправка, поток шагов), а `FormRenderer` рисует полученный бандл.

## Installation

```bash
npm install @reformer/renderer-react @reformer/core react react-dom
```

## Import Patterns

```typescript
// recommended
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineFormBehavior, hideWhen, onComponentEvent } from '@reformer/core/behaviors';
import { FormRenderer, type RenderNode } from '@reformer/renderer-react';
```

## Quick Start

> **Ключевой момент** — сборка идёт ОДНИМ вызовом `createForm`, а рендерер принимает её результат
> пропом `form`. Билдер схемы — `(model) => узел`: он вызывается один раз, второго прохода «с
> формой» нет. Лист-узел находит ноду поля по ручке модели через реестр, который заполняет сборка;
> без неё поле рендерится как `null` с предупреждением.

```tsx
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer, type RenderNode } from '@reformer/renderer-react';
import { Box, Section, Input, FormField } from '@reformer/ui-kit';

interface MyForm {
  email: string;
  password: string;
}

// (1) Дерево схемы: листья привязаны к ручкам модели (`model.$.<field>`).
const mySchema = (model: FormModel<MyForm>): RenderNode<MyForm> => ({
  component: Box,
  componentProps: { className: 'space-y-4' },
  children: [
    {
      component: Section,
      componentProps: { title: 'Вход' },
      children: [
        { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
        {
          model: model.$.password,
          component: Input,
          componentProps: { label: 'Пароль', type: 'password' },
        },
      ],
    },
  ],
});

function MyFormPage() {
  // (2) Модель + форма + скомпилированная схема + уровень формы — одним вызовом. useFormBundle
  //     (ленивый useState) зовёт фабрику ровно один раз: useMemo не годится, React вправе сбросить
  //     его кэш и пересобрать форму, потеряв введённое.
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ initial: { email: '', password: '' }, schema: mySchema })
  );

  // (3) Бандл целиком уходит рендереру; программное управление узлами — bundle.render.node(sel).
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}
```

### Multi-step forms

Визард в схеме — обычный узел: `{ selector: 'wizard', component: FormWizard, children: [шаги] }`
(`FormWizard` из `@reformer/ui-kit`). Шаг — узел `{ selector: 'loan', component: Step,
componentProps: { title, icon }, children: [...] }` (`Step` из `@reformer/cdk/form-wizard`).
Правила шагов — поток сборки: `createForm({ flow: { steps: [{ id: 'loan', rules: loanRules }] } })`,
`id` шага равен `selector` его узла. Форму, поток и отправку визард берёт из сборки сам — пропсами
их передавать не нужно.

Полный рецепт — [07-form-wizard.md](07-form-wizard.md), он же `find_recipe wizard`.

### Container `children` — top-level свойство

`children` контейнера задаётся на самом узле, НЕ внутри `componentProps`:

```typescript
// CORRECT
{ component: Section, componentProps: { title: 'X' }, children: [ /* nodes */ ] }

// WRONG — children в componentProps игнорируется, поддерево не рендерится
{ component: Section, componentProps: { title: 'X', children: [ /* nodes */ ] } }
```

### Прежний путь: `createReactForm`

`createReactForm` + `useReactForm` остаются в пакете: билдер схемы `(model, form?)` вызывается дважды
(без формы — для сборки, с формой — для рендера), а правила узлов пишет отдельная фабрика
`renderBehavior(form, model, level)`; третий аргумент — уровень формы (`submit`, `flow`). Новому коду
он не нужен: сборка `createForm` даёт то же одним поведением формы — см. [08-form-bundle.md](08-form-bundle.md).

## Key Concepts

- **`RenderNode<T>`** — узел дерева, дискриминированный union: **field** (`ModelFieldRenderNode` — `model: model.$.x` + `component`), **array** (`ArrayRenderNode` — `model: model.$.items` + `item`), **part** (`PartRenderNode` — `model: model.$.group` + `part`), **container** (`ContainerRenderNode` — `component` + `children`). Ключей `value:` / `array:` у узла нет — это прежний контракт, компилятор их не читает.
- **Скомпилированная схема** — сборка компилирует дерево один раз (`compileSchema` из `@reformer/core`): у каждого узла есть `kind` (`field | array | part | container | text`), идентификатор и область. Рендер идёт по `bundle.render.tree`; контейнер без `component` рисует только своих детей.
- **`fieldWrapper`** — общая обёртка вокруг каждого поля (label, error). Передаётся через `settings`. Можно перекрыть для конкретного поля через `componentProps.fieldWrapper`.
- **Связывание поля и `FieldAdapter`** — лист связывает с моделью сам рендерер: seam (`value` + `onChange(value)` + `onBlur`) переводится в диалект контрола (`checked` + `onCheckedChange`, `value` + `onChange(event)`, `value` + `onChange(value, option)` и т.д.) по `FieldAdapter`. Адаптер берётся из статики компонента `reformerAdapter` (компоненты `@reformer/ui-kit` её уже объявляют — в `component` кладётся сам компонент, «field-версий» нет; свой контрол — `defineFieldControl(C, { adapter })` из `@reformer/ui-kit/fields`). Для чужих компонентов без статики — вторая настройка `settings` рядом с `fieldWrapper`: `resolveFieldAdapter(component)`, она приоритетнее статики. Нет ни того, ни другого → seam применяется как есть. Императивный `FieldHandle` для `schema.node(sel).getRef()` тоже строит рендерер: handle контрола либо базовый handle из его DOM-узла. Рецепт — [05-cookbook.md](05-cookbook.md).
- **Поведение формы** — `defineFormBehavior(({ model, form, schema, flow }) => …)` из `@reformer/core/behaviors`: операторы узлов (`hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount`) адресуют узлы `schema.node(selector)`, а рендерер исполняет записанные правила. См. [03-render-behavior.md](03-render-behavior.md).
- **`createRenderSchema(fn)`** — низкоуровневый путь: превращает `RenderSchemaFn` в `RenderSchemaProxy` с `.node(selector)` для рендера `<FormRenderer render={proxy} />` без бандла.

## Components and exports

| Export                                                                           | Purpose                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `FormRenderer`                                                                   | Рендер формы. Пропы: `{ form }` (бандл) ЛИБО `{ render }`, + `settings`. |
| `RenderNodeComponent`                                                            | Рендер одного узла (ручная композиция, тело шага в JSX).               |
| `RenderContextProvider`, `useRenderContext`                                      | Контекст рендеринга: `form`, `settings`.                                |
| `RenderNode`, `ModelFieldRenderNode`, `ArrayRenderNode`, `PartRenderNode`, `ContainerRenderNode` | Типы узлов схемы.                                       |
| `ArrayComponentProps`, `ArrayItemSlot`                                           | Контракт компонента-рендерера массива.                                  |
| `RenderNodeFn`                                                                   | Проп `renderNode` компонентов с `__selfManagedChildren` (визард, табы). |
| `createRenderSchema`, `isRenderSchemaProxy`                                      | Низкоуровневое программное управление схемой.                          |
| `isHtmlTagRenderNode`, `VOID_HTML_TAGS`                                          | HTML-тег в `component`; вид узла — `kind` из `compileSchema`.           |
| `hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount` | Операторы узлов (те же, что в `@reformer/core/behaviors`).              |
| `createReactForm`, `useReactForm`                                                | Прежний путь сборки (`renderBehavior(form, model, level)`).             |

## See also

- [02-render-schema.md](02-render-schema.md) — узлы схемы, массивы, подформы.
- [03-render-behavior.md](03-render-behavior.md) — hideWhen, renderEffect, lifecycle.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
- [05-cookbook.md](05-cookbook.md) — рецепты из реального кода.
- [06-validation.md](06-validation.md) — правила над моделью, поток шагов, тексты замечаний.
- [07-form-wizard.md](07-form-wizard.md) — многошаговая форма.
- [08-form-bundle.md](08-form-bundle.md) — рендер бандла `createForm`, области схемы.
