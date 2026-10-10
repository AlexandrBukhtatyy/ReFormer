---
sidebar_position: 2
---

# Быстрый старт

Соберём форму обратной связи за пять минут. Пройдём весь путь M1: **модель → схема → валидация →
сборка → рендер → отправка**.

## Шаг 1. Тип формы

```typescript
type ContactForm = {
  name: string;
  email: string;
  message: string;
};
```

:::tip `type` или `interface` — без разницы
Сборке подходит любой объектный тип. Как развести тип ввода и тип вычисляемых полей — в
[Структуре проекта](../patterns/project-structure#тип-формы-ввод-и-расчёт).
:::

## Шаг 2. Модель — источник истины

Модель хранит значения. Обычный на вид объект, где под каждым полем стоит реактивный сигнал.

```typescript
import { createModel } from '@reformer/core';

const model = createModel<ContactForm>({ name: '', email: '', message: '' });
```

Отдельно создавать модель не обязательно: сборка `createForm` (Шаг 5) сама создаёт её из `initial`.

## Шаг 3. Схема — привязка полей

Схема описывает **разметку**: дерево узлов, где узел поля привязывает компонент к ручке модели
(`model: model.$.<field>`) и держит его пропсы, а контейнер перечисляет вложенные узлы в `children`.
Схему пишут **билдером** `(model) => узел`: узлы держат сами ручки модели, поэтому дерево строится
после неё. Правил здесь нет — они живут отдельной схемой (Шаг 4).

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input, Textarea } from '@reformer/ui-kit';

const contactSchema = (model: FormModel<ContactForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.name,
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Ваше имя' },
    },
    {
      model: model.$.email,
      component: Input,
      componentProps: { label: 'Email', type: 'email' },
    },
    {
      model: model.$.message,
      component: Textarea,
      componentProps: { label: 'Сообщение' },
    },
  ],
});
```

:::info Schema-driven UI
Компонент и его пропсы (`label`, `placeholder`, `type`, `options`) объявляются в **узле схемы**, а
не в JSX. В разметке рендерится один универсальный `<FormField control={form.x} />` — он сам подтянет
`componentProps`, значение и замечания. Не пишите свои обёртки с `label`-пропами.
:::

## Шаг 4. Валидация — отдельная схема

Правила — это отдельный слой, а не часть разметки. Схема валидации — обычная функция над моделью,
обёрнутая в `defineValidation`. Внутри работают операторы из `@reformer/core/validation`:
`validate(model.$.<field>, [rules])` навешивает правила поля. Правила — чистые фабрики из
`@reformer/core/validators`.

```typescript
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

const contactValidation = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.message, [required(), minLength(10)]);
});
```

:::tip Текста в правиле нет
Правило возвращает только код замечания (`required`, `minLength`) и параметры. Текст для
пользователя даёт словарь активной локали, а свой текст поля задаётся кодом правила
(`required({ code: 'name.required' })`) и словарём `defineIssueMessages` — см.
[Обзор валидации](../validation/overview#тексты-замечаний).
:::

## Шаг 5. Сборка формы

`createForm` за один вызов создаёт модель (из `initial` или принимает готовую `model`), строит
ноды поверх её сигналов, подключает правила валидации и поведение. Результат — **сборка**
(`FormBundle`):

```typescript
import { createForm } from '@reformer/core';

const contact = createForm<ContactForm>({
  initial: { name: '', email: '', message: '' },
  schema: contactSchema, // билдер (model) => дерево
  validation: contactValidation, // правила формы — стабильная ссылка
});

contact.model; // модель — значения
contact.form; // FormGroup<ContactForm> — ноды полей: contact.form.email
await contact.validate(); // ValidationResult — проверить всю форму и показать замечания
await contact.submit((values) => api.sendContact(values)); // проверить и, если всё верно, отправить
```

## Шаг 6. Рендер и отправка

В React собирайте форму **один раз** — через `useFormBundle` (ленивый `useState`). `useMemo` для этого
не годится: React вправе сбросить его кэш, и форма пересоберётся вместе с потерей введённого.
Универсальный `FormField` из `@reformer/ui-kit` делает всю работу по связыванию поля с состоянием.

```tsx
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, Textarea, Button } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string; message: string };

const contactSchema = (model: FormModel<ContactForm>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
    { model: model.$.message, component: Textarea, componentProps: { label: 'Сообщение' } },
  ],
});

// Правила — стабильная константа модуля: по паре (модель, правила) раннер отменяет устаревшие
// прогоны, поэтому пересоздавать схему на каждый рендер нельзя.
const contactValidation = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.name, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.message, [required(), minLength(10)]);
});

const sendContact = (values: ContactForm) => api.sendContact(values); // ваш слой отправки

export function ContactFormView() {
  // Сборка ОДНИМ вызовом. useFormBundle зовёт фабрику ровно один раз.
  const contact = useFormBundle(() =>
    createForm<ContactForm>({
      initial: { name: '', email: '', message: '' },
      schema: contactSchema,
      validation: contactValidation,
    })
  );
  const { form, model } = contact;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Один прогон всех правил: замечания разносятся по полям и показываются,
    // обработчик вызывается только если блокирующих замечаний нет.
    const outcome = await contact.submit(sendContact);
    if (outcome.status === 'submitted') model.reset();
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

`submit` возвращает `SubmitResult` — по `status` видно, чем закончилась отправка:

| `status`                          | Что произошло                                                            |
| --------------------------------- | ------------------------------------------------------------------------ |
| `submitted`                       | правила прошли, обработчик отработал; его результат — в `result`         |
| `invalid` / `error` / `cancelled` | проверка не пропустила, обработчик не вызывался; детали — в `validation` |
| `failed`                          | обработчик бросил исключение — оно в `error`                             |

:::tip Рендер по дереву схемы
Ту же сборку умеет нарисовать целиком `FormRenderer` из
[`@reformer/renderer-react`](/docs/packages/renderer-react): он обходит дерево схемы, и JSX с
`FormField` для каждого поля писать не нужно.
:::

## Итог

Готовая форма с:

- ✅ типобезопасностью на TypeScript;
- ✅ декларативной валидацией отдельным слоем;
- ✅ автоматическим показом замечаний;
- ✅ минимумом кода в разметке.

## Дальше

- [Основные концепции](../core-concepts/reactive-state) — реактивность, модель, ноды, схемы.
- [Валидация](../validation/overview) — все встроенные валидаторы, тексты замечаний и кастомные правила.
- [Behaviors](../behaviors/overview) — вычисляемые поля и условная логика.
- [Свои компоненты полей](../react/custom-fields) — если нужен не `@reformer/ui-kit`.
