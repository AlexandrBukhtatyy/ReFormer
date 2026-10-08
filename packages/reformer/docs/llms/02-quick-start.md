## 1.5 QUICK START - Minimal Working Form

> **Schema-driven UI rule (read first)**: компонент И его пропсы (label, placeholder,
> options, type) объявляются в **узле схемы** (`component` + `componentProps`).
> В JSX рендерится один универсальный `<FormField control={form.x} />` из
> `@reformer/ui-kit` БЕЗ дополнительных props. Не пиши свои `Input`/`Select`/
> `Checkbox`-обёртки с `label`-prop'ами — это anti-pattern. См.
> `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")`.

**Модель данных** — источник истины значений. Схема — дерево узлов, привязанных к ручкам модели
(`model: model.$.field`). Сборка идёт ОДНИМ вызовом `createForm`: он создаёт модель, строит форму,
запускает поведение и собирает валидацию. Правил в схеме нет — они живут в отдельной схеме
`defineValidationSchema` из `@reformer/core/validation`, а запускает их раннер: `validation` сборки
либо `validateModel(model, schema)`.

```typescript
import {
  createForm,
  useFormBundle,
  type FormModel,
  type FormProxy,
  type FormSchemaNode,
} from '@reformer/core';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

// 1. Define form type as `type` alias (not `interface` — see Recipe 2)
type ContactForm = {
  name: string;
  email: string;
};

// 2. Схема — билдер (model) => дерево узлов. Узел поля: привязка `model` + component/componentProps.
//    Вложенные узлы лежат в `children`. Правил здесь нет — они в отдельной схеме (шаг 3).
const contactSchema = (model: FormModel<ContactForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.name,
      component: Input,
      componentProps: { label: 'Name', placeholder: 'Your name' },
    },
    {
      model: model.$.email,
      component: Input,
      componentProps: { label: 'Email', type: 'email' },
    },
  ],
});

// 3. Схема валидации — отдельный слой (@reformer/core/validation)
const contactValidation = defineValidationSchema<ContactForm>(({ model }) => {
  validate(model.$.name, [required({ message: 'Name is required' })]);
  validate(model.$.email, [required({ message: 'Email is required' }), email({ message: 'Invalid email' })]);
});

// 4. Сборка ОДНИМ вызовом: модель из initial + ноды поверх её сигналов + валидация.
const createContactForm = () =>
  createForm<ContactForm>({
    initial: { name: '', email: '' },
    schema: contactSchema,
    validation: contactValidation,
  });

// 5. Use in React component — thin JSX, FormField does ALL heavy lifting
function ContactFormComponent() {
  // useFormBundle зовёт фабрику ровно один раз и держит сборку стабильной между рендерами.
  const { model, form, validation } = useFormBundle(createContactForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Правила запускает раннер: validateAll() проверяет модель, разносит ошибки по полям и
    // показывает их. true — только если блокирующих ошибок нет.
    if (await validation.validateAll()) {
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

// 6. Pass form to child components via props (NOT context!)
type FormStepProps = {
  form: FormProxy<ContactForm>;
};

function FormStep({ form }: FormStepProps) {
  return <FormField control={form.name} testId="name" />;
}
```

> **Стабильность сборки.** Форму создают ОДИН раз: в React — `useFormBundle(фабрика)`, вне React —
> константой модуля. Иначе форма пересоздаётся на каждый рендер. См. `28-submit-and-reset.md`,
> `29-async-preload.md`.

> **`form.validate()` и `form.submit()` правил не запускают.** Они отражают ошибки, которые уже
> разнёс раннер: `submit` не вызовет обработчик, пока на полях есть блокирующие ошибки, но сам
> схему не прогоняет. Перед отправкой вызывай `validation.validateAll()` (или `validateModel`).

### Arrays of objects — узел `{ model, item }`

Массивы объектов принадлежат модели (`model.arrayField`). В схеме массив под-форм объявляется узлом
`{ model: model.$.<path>, item: (itemModel) => узел }`, где `item` строит разметку одной строки из
её под-модели (`FormModel<Item>`):

```typescript
import { arrayOf, createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { FormArray, InputNumber, SelectAsync, Textarea } from '@reformer/ui-kit';

type PropertyItem = {
  type: 'apartment' | 'house';
  description: string;
  estimatedValue: number;
};

type MyForm = { properties: PropertyItem[] };

// шаблон новой строки — его кладёт `push()` без значения и кнопка «Добавить»
const blankProperty = (): PropertyItem => ({ type: 'apartment', description: '', estimatedValue: 0 });

// разметка одной строки: item.$.field — ручка под-модели строки
const propertyRow = (item: FormModel<PropertyItem>): FormSchemaNode => ({
  children: [
    {
      model: item.$.type,
      component: SelectAsync,
      componentProps: { label: 'Тип', options: [/* ... */] },
    },
    { model: item.$.description, component: Textarea, componentProps: { label: 'Описание' } },
    {
      model: item.$.estimatedValue,
      component: InputNumber,
      componentProps: { label: 'Стоимость' },
    },
  ],
});

const { model, form } = createForm<MyForm>({
  initial: { properties: arrayOf(blankProperty) },
  schema: (model) => ({
    children: [{ model: model.$.properties, component: FormArray, item: propertyRow }],
  }),
});

// Операции над массивом — на модели:
model.properties.push(); // новая строка по шаблону
model.properties.push({ type: 'house', description: '', estimatedValue: 0 });
model.properties.removeAt(0);
model.properties.length; // реактивная длина
form.properties.at(0); // форма строки
```

Подробнее в `10-arrays.md`, `21-array-operations.md` и `find_recipe(topic="form-array")`.

### When to write your own field components (advanced — rare)

Свои компоненты нужны ТОЛЬКО если:

- ты намеренно избегаешь `@reformer/ui-kit` (например, проект уже имеет свою design system)
- нужен особый низкоуровневый input, который не покрывается `FormField` + `componentProps`

В этом случае см. секцию `## 14.5 UI COMPONENT PATTERNS` ниже — но даже там
паттерн **schema-driven** (label/options не из JSX-props, а из `componentProps` через
`useFormControl(...).componentProps`).
