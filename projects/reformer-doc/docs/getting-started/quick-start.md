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

## Шаг 5. Форма

`createForm` строит ноды поверх сигналов модели и возвращает типизированный proxy. Форма собирается
из layout-схемы — валидацию она не принимает.

```typescript
import { createForm } from '@reformer/core';

const form = createForm<ContactForm>({ model, schema });
```

## Шаг 6. Рендер и отправка

В React создавайте `model` / `schema` / `validation` / `form` **один раз** через `useMemo`, иначе форма
пересоздастся на каждый рендер (и раннер потеряет стабильную ссылку на схему). Универсальный `FormField`
из `@reformer/ui-kit` делает всю работу по связыванию поля с состоянием.

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, Textarea, Button } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string; message: string };

export function ContactForm() {
  const { form, model, validation } = useMemo(() => {
    const model = createModel<ContactForm>({ name: '', email: '', message: '' });
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
    const validation = defineValidationSchema<ContactForm>(({ model }) => {
      validate(model.$.name, [required(), minLength(2)]);
      validate(model.$.email, [required(), email()]);
      validate(model.$.message, [required(), minLength(10)]);
    });
    const form = createForm<ContactForm>({ model, schema });
    return { form, model, validation };
  }, []);

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
