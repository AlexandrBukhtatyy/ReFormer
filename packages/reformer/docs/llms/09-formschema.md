## 8. SCHEMA FORMAT (CRITICALLY IMPORTANT)

Под M1 схема **привязывает поле к сигналу модели** (`value: model.$.field`) и держит
UI-конфиг (`component`/`componentProps`) + валидаторы. Значения принадлежат модели.

### Field node

```typescript
{
  value: model.$.fieldName,   // сигнал модели (PathAwareSignal) — обязателен
  component: Input,           // React-компонент
  componentProps?: object,    // пропсы (label, placeholder, options, type, ...)
  validators?: [...],         // чистые фабрики / ModelValidator
  asyncValidators?: [...],    // async ModelValidator
  disabled?: boolean,
  updateOn?: 'change' | 'blur' | 'submit',
  debounce?: number,
}
```

> `disabled` — **top-level поле узла** (начальное состояние); дальше управляется методами
> `form.field.disable()`/`enable()` и оператором `enableWhen`. `componentProps.disabled` — это
> UI-проп и на состояние узла **не влияет** (частая причина «computed-поле остаётся редактируемым»).

### Primitive Fields

```typescript
import { createModel, createForm } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { Input, Select, Checkbox } from '@reformer/ui-kit';

const model = createModel<MyForm>({ name: '', age: null, agree: false, status: 'active' });

const schema = {
  name: {
    value: model.$.name,
    component: Input,
    componentProps: { label: 'Name', placeholder: 'Enter name' },
    validators: [required()],
  },
  age: {
    value: model.$.age,
    component: Input,
    componentProps: { type: 'number', label: 'Age' },
  },
  agree: {
    value: model.$.agree,
    component: Checkbox,
    componentProps: { label: 'I agree to terms' },
  },
  status: {
    value: model.$.status,
    component: Select,
    componentProps: {
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  },
};

const form = createForm<MyForm>({ model, schema });
```

### Nested Objects

Вложенная группа модели — это сама по себе под-модель `FormModel<Sub>` (доступна как `model.<group>`,
с `.$`/API). Удобно вынести в builder, принимающий `FormModel<Sub>` — симметрично builder'у элемента
массива. Сигналы под-модели идентичны корневым: `model.address.$.city === model.$.address.city`.

```typescript
import type { FormModel } from '@reformer/core';

const addressNodes = (m: FormModel<Address>) => ({
  street: { value: m.$.street, component: Input, componentProps: { label: 'Street' } },
  city:   { value: m.$.city,   component: Input, componentProps: { label: 'City' } },
  zip:    { value: m.$.zip,    component: Input, componentProps: { label: 'ZIP' } },
});

const schema = {
  address: addressNodes(model.address),
};
```

### Arrays — `{ array, item }` node

Массив объектов объявляется узлом `{ array: model.<path>, item: (itemModel) => subSchema }`.
`item` строит под-схему из под-модели элемента (`FormModel<Item>`):

```typescript
import type { FormModel } from '@reformer/core';

const itemSchema = (item: FormModel<Item>) => ({
  id:   { value: item.$.id,   component: Input, componentProps: { label: 'ID' } },
  name: { value: item.$.name, component: Input, componentProps: { label: 'Name' } },
});

const schema = {
  items: { array: model.items, item: itemSchema },
};
```

### createForm API

```typescript
// M1: данные из модели + схема (+ опциональный декларативный behavior)
const form = createForm<MyForm>({
  model,                 // FormModel<MyForm> — обязателен
  schema,                // дерево узлов, привязанных к сигналам
  behavior: myBehavior,  // опционально: defineFormBehavior(...) из @reformer/core/behaviors
});

// Доступ к нодам через Proxy
form.name.setValue('John');
form.address.city.value.value;  // текущее значение (через сигнал)
model.items.push({ id: '1', name: 'Item' }); // операции над массивом — на модели
```

> **Тип `schema` в M1 — `unknown`, не `FormSchema<T>`.** Это осознанно: интерпретатор обходит
> произвольную структуру и собирает листья `{ value: signal, component?, ... }`, поэтому обёртки
> (`{ children: [...] }`, wizard/steps) компилируются. Строгий `FormSchema<T>` (keyed-map по полям
> `T`) применяется только на legacy-пути `createForm(schema)` без модели.

### createForm Returns a Proxy

```typescript
const form = createForm<MyForm>({ model, schema });

form.email;          // FieldNode<string> — TypeScript знает тип
form.address.city;   // FieldNode<string> — вложенный доступ
form.items.at(0);    // FormProxy<ItemType> — элемент массива

// IMPORTANT: Proxy не проходит instanceof! Используй type guards:
import { isFieldNode, isGroupNode, isArrayNode } from '@reformer/core';
if (isFieldNode(node)) { /* ... */ }
```
