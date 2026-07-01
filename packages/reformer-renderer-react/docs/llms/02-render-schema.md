# Render Schema

## Key Concepts

Единая схема (M1): одно дерево `RenderNode` описывает и layout, и привязку полей к модели. Привязка идёт через **сигналы модели** (`model.$.<field>`), а не через отдельный `path`-прокси.

- **`RenderSchemaFn<T>`** — `() => RenderNode<T>`. Без аргументов: возвращает корневой узел. Привязка к данным — через сигналы в листьях, поэтому legacy-аргумент `path` удалён.
- **`ModelFieldRenderNode`** — узел-поле. Несёт `value: Signal` (сигнал модели, `model.$.<field>`), `component` (UI-компонент), `componentProps` (пропсы поля). State-нода (errors/disabled/validation) резолвится по сигналу через реестр `getNodeForSignal` (реестр заполняет `createForm`).
- **`ArrayRenderNode<T>`** — узел-массив модели. Данные принадлежат модели (`array: model.<path>`), форма элемента описывается `item(itemModel)`, `initialValue` — значение/фабрика нового элемента.
- **`ContainerRenderNode<T>`** — узел-контейнер. В `component` — React-компонент, дочерние узлы задаются в **top-level** `children` (НЕ в `componentProps`).

Type guards:

```typescript
import {
  isModelFieldRenderNode,
  isArrayRenderNode,
  isContainerRenderNode,
} from '@reformer/renderer-react';

if (isModelFieldRenderNode(node)) {
  /* node.value — Signal; node.component — UI-компонент */
}
if (isArrayRenderNode(node)) {
  /* node.array — реактивный массив; node.item(im) — поддерево элемента */
}
if (isContainerRenderNode(node)) {
  /* node.children — RenderNode[] (top-level, не в componentProps) */
}
```

## Examples

Двухколоночная форма с секцией. Листья несут `value: model.$.x` (сигнал) + `component` + `componentProps`. `children` — top-level свойство контейнера:

```tsx
import type { FormModel } from '@reformer/core';
import type { RenderSchemaFn } from '@reformer/renderer-react';
import { Box, Section, Input } from '@reformer/ui-kit';

const buildSchema = (model: FormModel<MyForm>): RenderSchemaFn<MyForm> => {
  const m = model.$;
  return () => ({
    component: Box,
    componentProps: { className: 'grid grid-cols-2 gap-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Личные данные', className: 'space-y-4' },
        children: [
          { value: m.firstName, component: Input, componentProps: { label: 'Имя' } },
          { value: m.lastName, component: Input, componentProps: { label: 'Фамилия' } },
        ],
      },
    ],
  });
};
```

### Массив модели

Узел-массив: `array` — реактивный массив модели, `item(itemModel)` строит поддерево по под-модели элемента, `initialValue` — фабрика нового элемента для кнопки «Добавить». Оформление секции (заголовок, кнопки, empty-message, reorder) — в `componentProps`:

```tsx
import { Box, Input, Select } from '@reformer/ui-kit';

const coBorrowersNode = {
  selector: 'co-borrowers-array',
  array: model.coBorrowers,
  initialValue: createBlankCoBorrower,
  componentProps: {
    title: 'Созаемщики',
    itemLabel: 'Созаемщик',
    addButtonLabel: '+ Добавить созаемщика',
    emptyMessage: 'Нажмите «Добавить созаемщика»',
    reorderable: true,
  },
  item: (im: any) => ({
    component: Box,
    componentProps: { className: 'space-y-3' },
    children: [
      { value: im.$.phone, component: Input, componentProps: { label: 'Телефон' } },
      { value: im.$.relationship, component: Select, componentProps: { label: 'Отношение' } },
    ],
  }),
};
```

Внутри `item` листья привязываются к сигналам **под-модели** элемента (`im.$.<field>`). Per-item форму создаёт `ModelArrayNode`, материализованный `createForm` — рендерер итерирует элементы и рисует поддерево для каждого.

## Programmatic API

`createRenderSchema(fn)` оборачивает `RenderSchemaFn` в `RenderSchemaProxy`, который позволяет адресовать узлы по `selector` и навешивать поведение/lifecycle. Селектор задаётся на самом узле (`node.selector`):

```tsx
import { createRenderSchema, hideWhen } from '@reformer/renderer-react';

const schema = createRenderSchema<MyForm>(buildSchema(model));

// Императивное управление узлом по selector:
schema.node('extra-section').setHidden(true);
schema.node('extra-section').patchProps({ title: 'Новый заголовок' });
schema.node('extra-section').resetHidden();

// Декларативное реактивное скрытие (standalone-хелпер, читает сигналы формы):
hideWhen(schema.node('extra-section'), () => !form.subscribe.value.value);

<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
```

`FormRenderer` не принимает проп `form` — форма для wizard-узла передаётся через `componentProps` этого узла. См. [01-overview.md](01-overview.md).

## Anti-patterns

- **Возвращать React-element вместо `RenderNode`** — `RenderSchemaFn` должна возвращать описание (`{ component, componentProps, children }` или `{ value, component }`), а не JSX. Сам JSX строит `FormRenderer`.
- **Класть `children` в `componentProps`** — `children` это TOP-LEVEL свойство контейнера. Рендерер деструктурирует `const { children } = node`. В `componentProps.children` узлы не отрисуются.
- **Хранить `RenderSchemaProxy` внутри компонента без `useMemo`** — на каждом ре-рендере создаётся новый proxy, что ломает override-карты и lifecycle-хуки.
- **Забыть `createForm` перед рендером** — лист-узел резолвит state-ноду по сигналу через реестр. Без `createForm({ model, schema })` реестр пуст, поле логирует warning и рендерится как `null`.

## See also

- [01-overview.md](01-overview.md) — mount-путь и `FormRenderer`.
- [03-render-behavior.md](03-render-behavior.md) — `hideWhen`, `renderEffect`, lifecycle.
- [04-troubleshooting.md](04-troubleshooting.md).
