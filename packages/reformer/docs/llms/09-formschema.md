## 8. SCHEMA FORMAT (CRITICALLY IMPORTANT)

Схема — **дерево узлов**. Узел привязан к части модели ключом `model` и держит UI-конфиг
(`component` / `componentProps`). Значения принадлежат модели. Правил валидации в схеме НЕТ — они
живут в отдельной схеме `defineValidationSchema` из `@reformer/core/validation`.

### Четыре вида узла

Тип узла — `FormSchemaNode`, закрытый union. Вид определяют ключи `model`, `item`, `part` и
`children`:

| Вид             | Ключи                             | Пример                                              |
| --------------- | --------------------------------- | --------------------------------------------------- |
| поле            | `model` — лист или массив целиком | `{ model: model.$.email, component: Input }`        |
| массив под-форм | `model` — массив + `item`         | `{ model: model.$.phones, item: phoneRow }`         |
| подформа        | `model` — группа + `part`         | `{ model: model.$.address, part: address }`         |
| контейнер       | `children`                        | `{ component: Section, children: [/* узлы */] }`    |

Общие ключи любого узла: `component`, `componentProps`, `selector`. У поля ещё `disabled`, у
массива под-форм — `initialValue` (запасной шаблон новой строки).

```typescript
// Поле
{
  model: model.$.fieldName,   // ручка значения из model.$ — обязательна
  component: Input,           // React-компонент
  componentProps?: object,    // пропсы (label, placeholder, options, type, ...)
  disabled?: boolean,         // поле создаётся отключённым
  selector?: string,          // имя узла для поведения: schema.node('…')
}
```

> **Вложенные узлы читаются только из `children` и из поддерева `part`.** В `componentProps` и под
> произвольными ключами сборка не заглядывает: узел, положенный туда, полем не станет. В dev
> сборка предупреждает о ключах узла, которые она не читает.

> **Тип закрыт — ошибки ловит компилятор:** опечатка в ключе (`componnet`), группа без `part`,
> `item` не на массиве, привязка value-фасадом (`model: model.email` вместо `model.$.email`) и
> узлы под произвольными ключами (`{ email: { model, component } }`) не компилируются.

> `disabled` — **ключ узла** (начальное состояние); дальше состоянием управляют методы
> `form.field.disable()` / `enable()` и оператор `enableWhen`. `componentProps.disabled` — это
> UI-проп и на состояние поля **не влияет** (частая причина «computed-поле остаётся редактируемым»).

### Primitive Fields

```typescript
import { createModel, createFormFromModel, type FormSchemaNode } from '@reformer/core';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Input, InputNumber, SelectAsync, CheckboxWithLabel } from '@reformer/ui-kit';

const model = createModel<MyForm>({ name: '', age: null, agree: false, status: 'active' });

// Валидация — отдельным слоем (запуск: await validateModel(model, myValidation))
const myValidation = defineValidationSchema<MyForm>(({ model }) => {
  validate(model.$.name, [required()]);
});

const schema: FormSchemaNode = {
  children: [
    {
      model: model.$.name,
      component: Input,
      componentProps: { label: 'Name', placeholder: 'Enter name' },
    },
    {
      model: model.$.age,
      component: InputNumber,
      componentProps: { label: 'Age' },
    },
    {
      model: model.$.agree,
      component: CheckboxWithLabel,
      componentProps: { label: 'I agree to terms' },
    },
    {
      model: model.$.status,
      component: SelectAsync,
      componentProps: {
        label: 'Status',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    },
  ],
};

const form = createFormFromModel<MyForm>({ model, schema });
```

Поле данных может называться как угодно — `value`, `schema`, `form`, `model`, `children`: вид ноды
определяет узел модели, а не имя.

### Nested Objects — подформа `{ model, part }`

Вложенная группа модели — под-модель `FormModel<Sub>`. Её разметку объявляют один раз функцией от
под-модели и подключают к группе узлом-подформой. Привязки внутри части идут через `$` полученной
под-модели:

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';

const address = (model: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: model.$.street, component: Input, componentProps: { label: 'Street' } },
    { model: model.$.city, component: Input, componentProps: { label: 'City' } },
    { model: model.$.zip, component: Input, componentProps: { label: 'ZIP' } },
  ],
});

const schema: FormSchemaNode = {
  children: [
    // Одна часть подключается к любой группе той же формы данных — сколько угодно раз.
    { model: model.$.registrationAddress, part: address },
    { model: model.$.residenceAddress, part: address },
  ],
};
```

Поля группы можно привязать и напрямую, без подформы:
`{ model: model.$.address.city, component: Input }`.

### Arrays — массив под-форм `{ model, item }`

`item` строит разметку строки из под-модели строки (`FormModel<Item>`):

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';

const itemRow = (item: FormModel<Item>): FormSchemaNode => ({
  children: [
    { model: item.$.id, component: Input, componentProps: { label: 'ID' } },
    { model: item.$.name, component: Input, componentProps: { label: 'Name' } },
  ],
});

const schema: FormSchemaNode = {
  children: [{ model: model.$.items, component: FormArray, item: itemRow }],
};
```

Массив **без** `item` и с `component` — одно значение поля (мультивыбор, теги, список файлов):
`{ model: model.$.tags, component: SelectMulti }`.

### createForm API

```typescript
// Сборка одним вызовом: модель, форма, валидация и дерево для рендера
const bundle = createForm<MyForm>({
  initial,                 // либо готовая модель: model
  schema: (model) => tree, // билдер дерева: узлы держат ручки модели
  behavior: myBehavior,    // опционально: defineFormBehavior(...) из @reformer/core/behaviors
  validation: myRules,     // опционально: схема либо { steps, extras }
});

// Низкоуровневая фабрика: готовые модель и дерево
const form = createFormFromModel<MyForm>({ model, schema, behavior: myBehavior });

// Доступ к нодам через Proxy
form.name.setValue('John');
form.address.city.value.value; // текущее значение (через сигнал)
model.items.push({ id: '1', name: 'Item' }); // операции над массивом — на модели
```

При сборке (`createForm`, dev-режим) проверяются селекторы корневого дерева: повтор `selector`,
правило поведения на узел, которого нет в дереве, и ключ `validation.steps`, для которого нет шага
с таким `selector`, дают предупреждение в консоли.

### createForm Returns a Proxy

```typescript
const form = createFormFromModel<MyForm>({ model, schema });

form.email;          // FieldNode<string> — TypeScript знает тип
form.address.city;   // FieldNode<string> — вложенный доступ
form.items.at(0);    // FormProxy<ItemType> — форма строки массива

// IMPORTANT: Proxy не проходит instanceof! Используй type guards:
import { isFieldNode, isGroupNode, isArrayNode } from '@reformer/core';
if (isFieldNode(node)) { /* ... */ }
```
