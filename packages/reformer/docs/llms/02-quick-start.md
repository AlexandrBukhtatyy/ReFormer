## 1.5 QUICK START - Minimal Working Form

> **Schema-driven UI rule (read first)**: компонент И его пропсы (label, placeholder,
> options, type) объявляются в **узле схемы** (`component` + `componentProps`).
> В JSX рендерится один универсальный `<FormField control={form.x} />` из
> `@reformer/ui-kit` БЕЗ дополнительных props. Не пиши свои `Input`/`Select`/
> `Checkbox`-обёртки с `label`-prop'ами — это anti-pattern. См.
> `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")`.

**Модель данных** — источник истины значений. Схема — дерево узлов, привязанных к ручкам модели
(`model: model.$.field`). Сборка идёт ОДНИМ вызовом `createForm`: он создаёт модель, строит форму,
запускает поведение и собирает уровень формы — проверку и отправку. Правил в схеме нет — они
живут в отдельной схеме `defineValidation` из `@reformer/core/validation` и уходят в сборку полем
`validation`; запускает их `bundle.submit(handler)` / `bundle.validate()`. Текста у правил нет:
правило несёт код, строку по коду даёт словарь формы (`defineIssueMessages`).

```typescript
import { createForm, type FormModel, type FormGroup, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineIssueMessages } from '@reformer/core/i18n';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormField, Input, Button } from '@reformer/ui-kit';

// 1. Form data type — `interface` or `type`, both work
interface ContactForm {
  name: string;
  email: string;
}

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

// 3. Схема валидации — отдельный слой (@reformer/core/validation). Правило несёт код, не текст.
const contactValidation = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.name, [required({ code: 'name.required' })]);
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
});

// 4. Тексты замечаний по кодам — словарь формы (встроенный код `email` берёт текст из локали)
const contactMessages = defineIssueMessages({
  'name.required': 'Укажите имя',
  'email.required': 'Укажите email',
});

// 5. Сборка ОДНИМ вызовом: модель из initial + ноды поверх её сигналов + уровень формы.
const createContactForm = () =>
  createForm<ContactForm>({
    initial: { name: '', email: '' },
    schema: contactSchema,
    validation: contactValidation,
  });

// 6. Use in React component — thin JSX, FormField does ALL heavy lifting
function ContactFormComponent() {
  // useFormBundle зовёт фабрику ровно один раз и держит сборку стабильной между рендерами.
  const contact = useFormBundle(createContactForm);
  const { form } = contact;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Один прогон всех правил: при замечаниях обработчик не вызывается, а поля помечаются
    // тронутыми — FormField покажет замечания.
    const outcome = await contact.submit((values) => api.send(values));
    if (outcome.status === 'submitted') console.log('Form submitted');
  };

  return (
    <ValidationMessagesProvider messages={contactMessages}>
      <form onSubmit={handleSubmit}>
        <FormField control={form.name} testId="name" />
        <FormField control={form.email} testId="email" />
        <Button type="submit">Send</Button>
      </form>
    </ValidationMessagesProvider>
  );
}

// 7. Pass form to child components via props (NOT context!)
type FormStepProps = {
  form: FormGroup<ContactForm>;
};

function FormStep({ form }: FormStepProps) {
  return <FormField control={form.name} testId="name" />;
}
```

> **Стабильность сборки.** Форму создают ОДИН раз: в React — `useFormBundle(фабрика)`, вне React —
> константой модуля. Иначе форма пересоздаётся на каждый рендер. См. `28-submit-and-reset.md`,
> `29-async-preload.md`.

> **Проверка и отправка — уровень формы.** `bundle.submit(handler)` прогоняет все правила один раз
> и зовёт обработчик только при статусе `valid`; результат — `SubmitResult`
> (`submitted` / `invalid` / `error` / `cancelled` / `failed`). `bundle.validate()` проверяет всю
> форму и отвечает `ValidationResult`. У нод методов `validate()` / `submit()` нет. Многошаговая
> форма — `createForm({ flow: { steps: [{ id, rules }] } })`, см. `38-form-flow.md`.

### Arrays of objects — узел `{ model, item }`

Массивы объектов принадлежат модели (`model.arrayField`). В схеме массив под-форм объявляется узлом
`{ model: model.$.<path>, item: (itemModel) => узел }`, где `item` строит разметку одной строки из
её под-модели (`FormModel<Item>`):

```typescript
import { arrayOf, createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { FieldArray, InputNumber, SelectAsync, Textarea } from '@reformer/ui-kit';

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
    children: [{ model: model.$.properties, component: FieldArray, item: propertyRow }],
  }),
});

// Операции над массивом — на модели:
model.properties.push(); // новая строка по шаблону
model.properties.push({ type: 'house', description: '', estimatedValue: 0 });
model.properties.removeAt(0);
model.properties.length; // реактивная длина
form.properties.at(0); // форма строки (FormGroup<PropertyItem>)
form.properties.length; // число строк (число, не сигнал)
form.properties.keyAt(0); // стабильный ключ строки — для React `key`
```

Подробнее в `10-arrays.md`, `21-array-operations.md` и `find_recipe(topic="form-array")`.

### When to write your own field components (advanced — rare)

Свои компоненты нужны ТОЛЬКО если:

- ты намеренно избегаешь `@reformer/ui-kit` (например, проект уже имеет свою design system)
- нужен особый низкоуровневый input, который не покрывается `FormField` + `componentProps`

В этом случае см. секцию `## 14.5 UI COMPONENT PATTERNS` ниже — но даже там
паттерн **schema-driven** (label/options не из JSX-props, а из `componentProps` через
`useFormControl(...).componentProps`).
