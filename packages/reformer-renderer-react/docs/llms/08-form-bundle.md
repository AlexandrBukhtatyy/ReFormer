# Рендер бандла `createForm`

## Purpose

`FormRenderer` рисует результат единой сборки `createForm` из `@reformer/core`. Схема — одно дерево
узлов с привязкой `model`; поведение формы получает схему в своей области и записывает правила
узлов; рендерер их исполняет. Отдельных `createReactForm`, `useReactForm` и `renderBehavior` для
этого не нужно — они остаются прежним путём.

Полное описание контракта — раздел «Единый контракт формы» в `reformer://docs/core`.

## Сборка и рендер

```tsx
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
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
- Скомпилированная схема лежит в `bundle.render.tree` (`CompiledSchema`: `root`, `nodes`,
  `fields`, `arrays`); `FormRenderer` её не перестраивает. Рендер идёт по `kind` узла:
  `field`, `array`, `part`, `container`, `text`.
- Обёртка поля: `settings.fieldWrapper`, иначе та, что положил в бандл реестр (JSON-вариант).
- Уровень формы — в том же бандле: `bundle.validate()`, `bundle.validateStep(id)`,
  `bundle.submit(handler)`, поток шагов `bundle.flow` (если в конфиге есть `flow`).

## Узлы схемы

| Узел            | Запись                                                 |
| --------------- | ------------------------------------------------------ |
| поле            | `{ model: model.$.email, component, componentProps }`  |
| массив под-форм | `{ model: model.$.items, component: FieldArray, item }` |
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
{ model: model.$.coBorrowers, component: FieldArray, item: coBorrower }
```

Порядок распознавания: `item` → `part` → поле → контейнер. Распознаёт компилятор ядра
`compileSchema`: у узла скомпилированной схемы есть `kind` (`field`, `array`, `part`,
`container`), нормализованная привязка (`handle`, у массива — `control`) и идентификатор в области.
Повтор `selector` в одной области — исключение при сборке. Контейнер без `component` рисует только
своих детей.

## Области схемы

`schema.node(selector)` адресует узлы своей области. Строка массива и подформа — отдельные
области: рендерер ставит им собственное хранилище правил.

```typescript
const addressBehavior = defineFormBehavior<Address>(({ model, schema }) => {
  hideWhen(schema.node('street'), () => model.city === ''); // узел внутри части
});

// apply / applyEach — из '@reformer/core/behaviors'
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

Компонент со статикой `__selfManagedChildren = true` (визард, табы) получает узлы-детей —
узлы скомпилированной схемы (`CompiledNode`: `selector`, `props` — бывшие `componentProps`,
`children`) — и проп `renderNode` — функцию, которая рисует узел. Импортировать рендерер
компоненту не нужно.

```tsx
function Tabs({
  children,
  renderNode,
}: {
  children: CompiledNode[];
  renderNode: RenderNodeFn;
}) {
  const [active, setActive] = useState(0);
  return <div>{renderNode(children[active])}</div>;
}
Tabs.__selfManagedChildren = true;
```

Форму, поток шагов и отправку такой компонент берёт из контекста сборки — `useFormBundleContext()`
из `@reformer/core/react` (`bundle.form`, `bundle.flow`, `bundle.submit`); контекст ставит
`FormRenderer`. Так устроен `FormWizard` из `@reformer/ui-kit` — см. [07-form-wizard.md](07-form-wizard.md).

## Частые ошибки

| Ошибка                                           | Как правильно                                            |
| ------------------------------------------------ | -------------------------------------------------------- |
| `schema: (model, form) => …` ради визарда        | `(model) => узел`; визард берёт форму из контекста       |
| `renderBehavior` рядом с `behavior`              | одно поведение: `({ model, form, schema, flow }) => …`   |
| `form.loanType.value.value` в условии `hideWhen` | `model.loanType`                                         |
| `<FormRenderer form={bundle} />` без `schema`    | у сборки без схемы дерева нет — рисуйте поля сами        |
| `initialValue` в каждом узле массива             | `arrayOf(blank)` в модели                                |
| ref визарда и `goToStep(n)` для навигации        | `flow.goTo(id)` в поведении, `bundle.flow` снаружи       |
