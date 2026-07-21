# Render Schema

## Key Concepts

Единая схема (M1): одно дерево `RenderNode` описывает и layout, и привязку полей к модели. Привязка идёт через **сигналы модели** (`model.$.<field>`), а не через отдельный `path`-прокси.

- **`RenderSchemaFn<T>`** — `() => RenderNode<T>`. Без аргументов: возвращает корневой узел. Привязка к данным — через сигналы в листьях, поэтому legacy-аргумент `path` удалён.
- **`ModelFieldRenderNode`** — узел-поле. Несёт `value: Signal` (сигнал модели, `model.$.<field>`), `component` (UI-компонент), `componentProps` (пропсы поля). State-нода (errors/disabled/validation) резолвится по сигналу через реестр `getNodeForSignal` (реестр заполняет `createForm`). Поля `validators` у узла **НЕТ** — правила валидации значений живут в отдельной TS-схеме над моделью, а не в render-дереве (`validators: [...]` на листе даст `TS2353`; см. [06-validation.md](06-validation.md)).
- **`ArrayRenderNode<T>`** — узел-массив модели. Данные принадлежат модели (`array: model.<path>`), форма элемента описывается `item(itemModel)`, `initialValue` — значение/фабрика нового элемента.
- **`ContainerRenderNode<T>`** — узел-контейнер. В `component` — React-компонент **либо нативный HTML-тег строкой** (`'div'`, `'h3'`, `'hr'`), дочерние узлы задаются в **top-level** `children` (НЕ в `componentProps`). Опциональный `text` задаёт текстовое содержимое.

Type guards:

```typescript
import {
  isModelFieldRenderNode,
  isArrayRenderNode,
  isContainerRenderNode,
  isHtmlTagRenderNode,
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
if (isHtmlTagRenderNode(node)) {
  /* node.component — строка-тег ('div'), а не компонент */
}
```

### HTML-узлы и текст

Презентационная вёрстка (заголовки, инфо-плашки, разделители, сводки) описывается прямо в схеме — отдельный React-компонент ради неё заводить не нужно:

```typescript
{
  component: 'div',
  componentProps: { className: 'p-4 bg-blue-50 rounded-md' },  // для тега это DOM-атрибуты
  children: [
    { component: 'h3', text: 'Итого' },
    { component: 'p', text: ['Платёж: ', model.$.monthlyPayment, ' ₽'] },
    { component: 'hr' },
  ],
}
```

- **`text`** принимает литерал (`string`/`number`), **сигнал** (`model.$.x` или `computed(...)`) или массив таких частей — массив склеивается без разделителя. `null`/`undefined` дают пустую строку.
- Сигнал подписывается **точечно**: при изменении модели перерисовывается только текст, а не поддерево узла.
- `text` рендерится **перед** `children` — так собирается inline-разметка: `{ component: 'p', text: 'Внимание! ', children: [{ component: 'b', text: 'платёж высокий' }] }` → `<p>Внимание! <b>платёж высокий</b></p>`.
- `selector` в DOM **не** пробрасывается (он адресует узел схемы, а не элемент), но `hideWhen`/`patchProps` по нему работают как обычно.
- Void-теги (`hr`, `br`, `img`) содержимого не получают — `text`/`children` для них игнорируются.
- `text` работает и на узле-компоненте: `{ component: Button, text: 'Отправить' }`.

## Examples

Двухколоночная форма с секцией. Листья несут `value: model.$.x` (сигнал) + `component` + `componentProps`. `children` — top-level свойство контейнера:

```tsx
import type { FormModel } from '@reformer/core';
import type { RenderSchemaFn } from '@reformer/renderer-react';
import { Box, Section, Input } from '@reformer/ui-kit';

const buildSchema = (model: FormModel<MyForm>): RenderSchemaFn<MyForm> => {
  return () => ({
    component: Box,
    componentProps: { className: 'grid grid-cols-2 gap-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Личные данные', className: 'space-y-4' },
        children: [
          { value: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
          { value: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
        ],
      },
    ],
  });
};
```

### Массив модели { #array }

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

**Top-level свойства узла** (не в `componentProps`): `array` (реактивный массив модели), `item(itemModel)` (схема элемента), `initialValue` (значение/фабрика нового элемента), `selector` (для behavior/override).

**Привязка `array` — это `model.<path>` (value-доступ), НЕ `model.$.<path>`** (напр. `array: model.coBorrowers`). Один нюанс типов: рантайм-массив совместим с требуемым `RenderModelArrayControl`, но в публичном типе `ModelArray<U>` не объявлен `__path`, поэтому под строгим контекстом узла TS даёт `TS2741: Property '__path' is missing in type 'ModelArray<T>'`. Канон (golden `complex-multy-step-form-renderer/render-schema.ts`) — билдер строит дерево и в конце кастует его `as unknown as RenderNode<T>`; привязка при этом остаётся `array: model.<path>`. Каст также снимает лишние проверки для листьев-полей.

**Полный контракт `componentProps`** нативной array-ноды (`ModelArraySectionRenderer`) — других полей нет:

| prop | default |
|---|---|
| `title?: string` | — |
| `addButtonLabel?: string` | `'+ Добавить'` |
| `removeButtonLabel?: string` | `'Удалить'` |
| `emptyMessage?: string` | — (показ при `length === 0`) |
| `itemLabel?: string \| ((im, i) => string)` | — (string → `` `${itemLabel} #${i + 1}` ``) |
| `reorderable?: boolean` | `false` (кнопки ↑/↓, `disabled` на концах) |
| `className?: string` | `'space-y-3 mt-2'` |
| `cardClassName?: string` | `'mb-4 p-4 bg-white rounded border'` |

**`maxItems` и `showRemoveOnSingle` НЕ существуют.** Это выдуманные props — рендерер их игнорирует. Кнопка «Удалить» авто-скрывается, когда `length <= 1` (hardcoded `const showRemove = length > 1`), настроить это нельзя. Чтобы ограничить количество элементов — используй behavior (`hideWhen` на add-аффордансе или guard в `initialValue`), а не проп.

Нативная `ArrayRenderNode` (`{ array, item }`) — канон для render-schema пути (одинаково для renderer-react и renderer-json; golden — `complex-multy-step-form-renderer/render-schema.ts`); `FormArraySection` из [ui-kit](../../../reformer-ui-kit/docs/llms/08-form-array-section.md) и `FormArray` из [cdk](../../../reformer-cdk/docs/llms/02-form-array.md) — для рукописного JSX. Они параллельны, а не конкурируют: array-нода описывает массив декларативно в дереве, compound-компоненты собирают его руками.

Testid-конвенции секции (для e2e): `array-add`, `array-item-{i}`, `array-item-{i}-remove`, `array-item-{i}-move-up`, `array-item-{i}-move-down`.

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
- **Заводить компонент ради статичного блока текста** — `{ component: 'div', children: [{ component: 'p', text: '…' }] }` описывает то же самое схемой; отдельный компонент нужен, когда есть своя логика или состояние.
- **Ожидать реактивности от интерполяции строкой** — `text: \`Платёж: ${model.$.x.value} ₽\`` читает значение ОДИН раз при построении схемы. Реактивен только сам сигнал: `text: ['Платёж: ', model.$.x, ' ₽']`.

## See also

- [01-overview.md](01-overview.md) — mount-путь и `FormRenderer`.
- [03-render-behavior.md](03-render-behavior.md) — `hideWhen`, `renderEffect`, lifecycle.
- [06-validation.md](06-validation.md) — валидация значений отдельной model-схемой (у RenderNode нет `validators`).
- [04-troubleshooting.md](04-troubleshooting.md).
