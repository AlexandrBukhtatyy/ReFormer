---
sidebar_position: 2
---

# Быстрый старт

Соберём форму обратной связи за пять минут. Пройдём весь путь M1: **модель → схема → валидация →
форма → рендер → отправка**.

## Шаг 1. Тип формы

```typescript
type ContactForm = {
  name: string;
  email: string;
  message: string;
};
```

:::tip Объявляйте форму через `type`, а не `interface`
Интерпретатору схемы удобнее работать с `type`-алиасами. Подробнее — в
[рецептах типобезопасности](../patterns/project-structure).
:::

## Шаг 2. Модель — источник истины

Модель хранит значения. Обычный на вид объект, где под каждым полем стоит реактивный сигнал.

```typescript
import { createModel } from '@reformer/core';

const model = createModel<ContactForm>({ name: '', email: '', message: '' });
```

## Шаг 3. Схема — привязка полей

Схема описывает **layout**: для каждого поля — привязку к сигналу модели (`value: model.$.<field>`),
компонент и его пропсы. Валидаторов здесь нет — правила живут отдельной схемой (Шаг 4).

```typescript
import { Input, Textarea } from '@reformer/ui-kit';

const schema = {
  name: {
    value: model.$.name,
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Ваше имя' },
  },
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
  message: {
    value: model.$.message,
    component: Textarea,
    componentProps: { label: 'Сообщение' },
  },
};
```

:::info Schema-driven UI
Компонент и его пропсы (`label`, `placeholder`, `type`, `options`) объявляются в **схеме поля**, а не
в JSX. В разметке рендерится один универсальный `<FormField control={form.x} />` — он сам подтянет
`componentProps`, значение и ошибки. Не пишите свои обёртки с `label`-пропами.
:::

## Шаг 4. Валидация — отдельная схема

Правила — это отдельный слой, а не часть layout. Схема валидации — обычная функция над моделью,
обёрнутая в `defineValidationSchema`. Внутри работают ambient-операторы из `@reformer/core/validation`:
`validate(sig, [rules])` навешивает правила поля. Правила — чистые фабрики из `@reformer/core/validators`.

```typescript
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

const validation = defineValidationSchema<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.message, [required(), minLength(10)]);
});
```

:::warning Валидация запускается по требованию, а не формой
Схему прогоняет внешний раннер `validateModel(model, validation)` (Шаг 6) — обычно на отправке.
`form.submit()` и `form.validate()` схему **не** запускают: это независимый слой. Раннер сам разносит
ошибки по нодам формы (`FormField` подсветит поля) и гасит поля, ставшие валидными.
:::

## Шаг 5. Сборка формы

`createCoreForm` за один вызов создаёт модель (или принимает готовую), строит ноды поверх её
сигналов, запускает поведение и собирает валидацию. Схему принимает **билдером**: листья держат сами
сигналы модели, поэтому дерево нельзя построить раньше неё.

```typescript
import { createCoreForm } from '@reformer/core';

const contact = createCoreForm<ContactForm>({
  model,
  schema: buildSchema, // (model) => дерево
  validation, // правила как данные → contact.validation с validateAll/validateStep
});
const form = contact.form;
```

## Шаг 6. Рендер и отправка

В React собирайте форму **один раз** — через `useFormBundle` (ленивый `useState`). `useMemo` для этого
не годится: React вправе сбросить его кэш, и форма пересоберётся вместе с потерей введённого, а раннер
валидации — стабильной ссылки на схему. Универсальный `FormField` из `@reformer/ui-kit` делает всю
работу по связыванию поля с состоянием.

```tsx
import { createCoreForm, useFormBundle, type FormModel } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, Textarea, Button } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string; message: string };

// Правила — стабильная module-level константа: по паре (model, schema) раннер отменяет устаревшие
// прогоны, поэтому пересоздавать схему на каждый рендер нельзя.
const validation = defineValidationSchema<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.message, [required(), minLength(10)]);
});

function buildSchema(model: FormModel<ContactForm>) {
  return {
    name: {
      value: model.$.name,
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Ваше имя' },
    },
    email: {
      value: model.$.email,
      component: Input,
      componentProps: { label: 'Email', type: 'email' },
    },
    message: {
      value: model.$.message,
      component: Textarea,
      componentProps: { label: 'Сообщение' },
    },
  };
}

export function ContactForm() {
  // Сборка ОДНИМ вызовом. useFormBundle (ленивый useState) зовёт фабрику ровно один раз —
  // useMemo не годится: React вправе сбросить его кэш и пересобрать форму, потеряв введённое.
  const { form, model } = useFormBundle(() =>
    createCoreForm<ContactForm>({
      initial: { name: '', email: '', message: '' },
      schema: buildSchema,
    })
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.touchAll();
    // Прогоняем валидацию по требованию; ошибки сами роутятся в ноды формы для показа.
    const valid = await validateModel(model, validation);
    if (valid) {
      console.log('Отправка:', model.get());
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.name} />
      <FormField control={form.email} />
      <FormField control={form.message} />
      <Button type="submit">Отправить</Button>
    </form>
  );
}
```

## Итог

Готовая форма с:

- ✅ типобезопасностью на TypeScript;
- ✅ декларативной валидацией отдельным слоем;
- ✅ автоматическим показом ошибок;
- ✅ минимумом кода в разметке.

## Дальше

- [Основные концепции](../core-concepts/reactive-state) — реактивность, модель, ноды, схемы.
- [Валидация](../validation/overview) — все встроенные валидаторы и кастомные правила.
- [Behaviors](../behaviors/overview) — вычисляемые поля и условная логика.
- [Свои компоненты полей](../react/custom-fields) — если нужен не `@reformer/ui-kit`.
