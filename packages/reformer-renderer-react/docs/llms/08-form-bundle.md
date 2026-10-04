# Рендер бандла `createForm`

## Purpose

`FormRenderer` рисует результат единой сборки `createForm` из `@reformer/core`. Схема — одно дерево
узлов с привязкой `model`; поведение формы получает схему в своей области и записывает правила
узлов; рендерер их исполняет. Отдельных `createReactForm`, `useReactForm` и `renderBehavior` для
этого не нужно — они остаются прежним путём.

Полное описание контракта — раздел «Единый контракт формы» в `reformer://docs/core`.

## Сборка и рендер

```tsx
import { createForm, useFormBundle, type FormModel } from '@reformer/core';
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';
import { FormRenderer, type RenderNode } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';

const mySchema = (model: FormModel<MyForm>): RenderNode<MyForm> => ({
  component: Box,
  children: [
    { model: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип кредита' } },
    {
      selector: 'mortgage',
      component: Section,
      componentProps: { title: 'Недвижимость' },
      children: [{ model: model.$.propertyValue, component: InputNumber }],
    },
  ],
});

const myBehavior = defineFormBehavior<MyForm>(({ model, schema }) => {
  hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');
});

function MyFormPage() {
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ model: createMyModel(), schema: mySchema, behavior: myBehavior })
  );
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}
```

- Билдер схемы — `(model) => узел`: вызывается один раз, второго прохода с формой нет.
- Дерево лежит в `bundle.render.tree`; `FormRenderer` его не перестраивает.
- Обёртка поля: `settings.fieldWrapper`, иначе та, что положил в бандл реестр (JSON-вариант).

## Узлы схемы

| Узел            | Запись                                                 |
| --------------- | ------------------------------------------------------ |
| поле            | `{ model: model.$.email, component, componentProps }`  |
| массив под-форм | `{ model: model.$.items, component: FormArray, item }` |
| подформа        | `{ model: model.$.address, part }`                     |
| контейнер       | `{ component, componentProps, children }`              |

```typescript
// подформа: объявлена один раз, стоит в схеме дважды
const address = (model: FormModel<Address>): RenderNode<MyForm> => ({
  component: Box,
  children: [
    { model: model.$.city, component: Input, componentProps: { label: 'Город' } },
    { selector: 'street', component: Box, children: [{ model: model.$.street, component: Input }] },
  ],
});

{ model: model.$.registrationAddress, part: address }
{ model: model.$.residenceAddress, part: address }

// строка массива — такая же функция от под-модели
{ model: model.$.coBorrowers, component: FormArray, item: coBorrower }
```

Порядок распознавания: `item` → `part` → поле → контейнер. Прежние ключи `value` (поле) и `array`
(массив) пока принимаются. Привязку узла читают `fieldBindingOf(node)`, `arrayControlOf(node)` и
`partModelOf(node)`; гарды — `isModelFieldRenderNode`, `isArrayRenderNode`, `isPartRenderNode`.

## Области схемы

`schema.node(selector)` адресует узлы своей области. Строка массива и подформа — отдельные
области: рендерер ставит им собственное хранилище правил.

```typescript
const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
  hideWhen(schema.node('street'), () => model.city === ''); // узел внутри части
});

const myBehavior = defineFormBehavior<MyForm>(({ model }) => {
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
  applyEach(model.$.coBorrowers, coBorrowerBehavior); // правила узлов строки — в её поведении
});
```

- Из корневого поведения узел строки или части не виден — правило на него ничего не сделает;
  в dev об этом предупреждают сборка и рендерер.
- Ref по абсолютному пути модели ищется от корня: `schema.node('phones.0.number').getRef()`.

## Кнопка «Добавить» секции массива

Компонент массива получает `onAdd()` без аргументов: рендерер зовёт `push()` без значения, а новый
элемент берётся из шаблона массива.

```typescript
// model.ts — шаблон рядом с остальными начальными значениями
createModel<MyForm>({ coBorrowers: arrayOf(blankCoBorrower) });
```

`initialValue` узла-массива — запасной шаблон для форм, чья модель создаётся из данных без кода;
шаблон модели главнее.

## Компонент, который сам управляет детьми

Компонент со статикой `__selfManagedChildren = true` (визард, табы) получает узлы-детей и проп
`renderNode` — функцию, которая рисует узел. Импортировать рендерер компоненту не нужно.

```tsx
function Tabs({
  children,
  renderNode,
}: {
  children: RenderNode<unknown>[];
  renderNode: RenderNodeFn;
}) {
  const [active, setActive] = useState(0);
  return <div>{renderNode(children[active])}</div>;
}
Tabs.__selfManagedChildren = true;
```

Форму и валидацию такой компонент берёт из контекста сборки — `useFormBundleContext()` из
`@reformer/core`; контекст ставит `FormRenderer`.

## Частые ошибки

| Ошибка                                           | Как правильно                                      |
| ------------------------------------------------ | -------------------------------------------------- |
| `schema: (model, form) => …` ради визарда        | `(model) => узел`; визард берёт форму из контекста |
| `renderBehavior` рядом с `behavior`              | одно поведение: `({ model, form, schema }) => …`   |
| `form.loanType.value.value` в условии `hideWhen` | `model.loanType`                                   |
| `<FormRenderer form={bundle} />` без `schema`    | у сборки без схемы дерева нет — рисуйте поля сами  |
| `initialValue` в каждом узле массива             | `arrayOf(blank)` в модели                          |
