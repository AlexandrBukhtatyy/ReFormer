## 1.5 QUICK START - Minimal Working Form

> **Schema-driven UI rule (read first)**: компонент И его пропсы (label, placeholder,
> options, type) объявляются в **схеме поля** (`component` + `componentProps`).
> В JSX рендерится один универсальный `<FormField control={form.x} />` из
> `@reformer/ui-kit` БЕЗ дополнительных props. Не пиши свои `Input`/`Select`/
> `Checkbox`-обёртки с `label`-prop'ами — это anti-pattern. См.
> `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")`.

Архитектура M1: сначала создаётся **модель данных** (`createModel`), затем **форма**
(`createForm({ model, schema })`), где схема привязывает поля к сигналам модели
(`model.$.field`). Layout-схема НЕ несёт валидаторов — валидация живёт в отдельной
схеме `defineValidationSchema` из `@reformer/core/validation` и запускается внешним
раннером `validateModel(model, schema)`.

```typescript
import { createModel, createForm, type FormProxy } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

// 1. Define form type as `type` alias (not `interface` — see Recipe 2)
type ContactForm = {
  name: string;
  email: string;
};

// 2. Model (источник истины значений)
const model = createModel<ContactForm>({ name: '', email: '' });

// 3. Layout-schema: привязка поля к сигналу (model.$.field) + component/componentProps.
//    БЕЗ validators — валидация в отдельной схеме (шаг 4).
const schema = {
  name: {
    value: model.$.name,
    component: Input,
    componentProps: { label: 'Name', placeholder: 'Your name' },
  },
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
};

// 4. Validation-schema — отдельный слой (@reformer/core/validation)
const contactValidation = defineValidationSchema<ContactForm>(({ model }) => {
  validate(model.$.name, [required({ message: 'Name is required' })]);
  validate(model.$.email, [required({ message: 'Email is required' }), email({ message: 'Invalid email' })]);
});

// 5. Form — ноды поверх сигналов модели
const form = createForm<ContactForm>({ model, schema });

// 6. Use in React component — thin JSX, FormField does ALL heavy lifting
function ContactFormComponent() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // form.submit()/validate() НЕ гоняют schema-валидацию — только внешний validateModel
    const ok = await validateModel(model, contactValidation); // Promise<boolean>, ошибки сам роутит в ноды
    if (ok) {
      console.log('Form submitted:', model.get());
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.name} testId="name" />
      <FormField control={form.email} testId="email" />
      <Button type="submit">Send</Button>
    </form>
  );
}

// 7. Pass form to child components via props (NOT context!)
type FormStepProps = {
  form: FormProxy<ContactForm>;
};

function FormStep({ form }: FormStepProps) {
  return <FormField control={form.name} testId="name" />;
}
```

> **Стабильность инстанса.** В React создавай model/schema/form ОДИН раз через `useMemo(() => { … }, [])`
> — иначе форма пересоздаётся на каждый рендер. См. `28-submit-and-reset.md`, `29-async-preload.md`.

### Arrays of objects — `{ array, item }` schema node

Массивы объектов принадлежат модели (`model.arrayField`). В схеме объявляются узлом
`{ array: model.<path>, item: (itemModel) => itemSchema }`, где `item` строит под-схему
для каждого элемента из его под-модели (`FormModel<Item>`):

```typescript
type PropertyItem = {
  type: 'apartment' | 'house';
  description: string;
  estimatedValue: number;
};

type MyForm = { properties: PropertyItem[] };

const model = createModel<MyForm>({ properties: [] });

// под-схема одного элемента: item.$.field — сигнал под-модели элемента
const propertyItem = (item: FormModel<PropertyItem>) => ({
  type: {
    value: item.$.type,
    component: Select,
    componentProps: { label: 'Тип', options: [/* ... */] },
  },
  description: { value: item.$.description, component: Textarea, componentProps: { label: 'Описание' } },
  estimatedValue: {
    value: item.$.estimatedValue,
    component: Input,
    componentProps: { label: 'Стоимость', type: 'number' },
  },
});

const schema = {
  properties: { array: model.properties, item: propertyItem },
};

const form = createForm<MyForm>({ model, schema });

// Операции над массивом — на модели:
model.properties.push({ type: 'apartment', description: '', estimatedValue: 0 });
model.properties.removeAt(0);
model.properties.length; // реактивная длина
```

Подробнее в `10-arrays.md`, `21-array-operations.md` и `find_recipe(topic="form-array")`.

### When to write your own field components (advanced — rare)

Свои компоненты нужны ТОЛЬКО если:

- ты намеренно избегаешь `@reformer/ui-kit` (например, проект уже имеет свою design system)
- нужен особый низкоуровневый input, который не покрывается `FormField` + `componentProps`

В этом случае см. секцию `## 14.5 UI COMPONENT PATTERNS` ниже — но даже там
паттерн **schema-driven** (label/options не из JSX-props, а из `componentProps` через
`useFormControl(...).componentProps`).
