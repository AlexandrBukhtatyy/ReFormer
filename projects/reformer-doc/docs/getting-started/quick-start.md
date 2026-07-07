---
sidebar_position: 2
---

# Быстрый старт

Соберём форму обратной связи за пять минут. Пройдём весь путь M1: **модель → схема → форма →
рендер → отправка**.

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

Схема — объект, где каждый ключ описывает поле: привязка к сигналу модели (`value: model.$.<field>`),
компонент, его пропсы и валидаторы. Валидаторы — чистые фабрики из `@reformer/core/validators`.

```typescript
import { required, email, minLength } from '@reformer/core/validators';
import { Input, Textarea } from '@reformer/ui-kit';

const schema = {
  name: {
    value: model.$.name,
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Ваше имя' },
    validators: [required(), minLength(2)],
  },
  email: {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
    validators: [required(), email()],
  },
  message: {
    value: model.$.message,
    component: Textarea,
    componentProps: { label: 'Сообщение' },
    validators: [required(), minLength(10)],
  },
};
```

:::info Schema-driven UI
Компонент и его пропсы (`label`, `placeholder`, `type`, `options`) объявляются в **схеме поля**, а не
в JSX. В разметке рендерится один универсальный `<FormField control={form.x} />` — он сам подтянет
`componentProps`, значение и ошибки. Не пишите свои обёртки с `label`-пропами.
:::

## Шаг 4. Форма

`createForm` строит ноды поверх сигналов модели и возвращает типизированный proxy.

```typescript
import { createForm } from '@reformer/core';

const form = createForm<ContactForm>({ model, schema });
```

## Шаг 5. Рендер и отправка

В React создавайте `model` / `schema` / `form` **один раз** через `useMemo`, иначе форма
пересоздастся на каждый рендер. Универсальный `FormField` из `@reformer/ui-kit` делает всю работу по
связыванию поля с состоянием.

```tsx
import { useMemo } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, Textarea, Button } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string; message: string };

export function ContactForm() {
  const { form, model, schema } = useMemo(() => {
    const model = createModel<ContactForm>({ name: '', email: '', message: '' });
    const schema = {
      name: {
        value: model.$.name,
        component: Input,
        componentProps: { label: 'Имя', placeholder: 'Ваше имя' },
        validators: [required(), minLength(2)],
      },
      email: {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email', type: 'email' },
        validators: [required(), email()],
      },
      message: {
        value: model.$.message,
        component: Textarea,
        componentProps: { label: 'Сообщение' },
        validators: [required(), minLength(10)],
      },
    };
    const form = createForm<ContactForm>({ model, schema });
    return { form, model, schema };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.touchAll();
    // Валидируем всю модель против схемы; ошибки роутятся в ноды для отображения.
    const { valid } = await validateFormModel(model, schema);
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
- ✅ декларативной валидацией;
- ✅ автоматическим показом ошибок;
- ✅ минимумом кода в разметке.

## Дальше

- [Основные концепции](../core-concepts/reactive-state) — реактивность, модель, ноды, схемы.
- [Валидация](../validation/overview) — все встроенные валидаторы и кастомные правила.
- [Behaviors](../behaviors/overview) — вычисляемые поля и условная логика.
- [Свои компоненты полей](../react/custom-fields) — если нужен не `@reformer/ui-kit`.
