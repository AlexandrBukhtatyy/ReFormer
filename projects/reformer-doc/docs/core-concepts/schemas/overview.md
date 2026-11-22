---
sidebar_position: 1
---

# Схемы: обзор

Форму описывают несколькими независимыми частями над одной [моделью](../model.mdx): какие поля
есть и чем они рисуются, какие у них правила, как поля реагируют друг на друга. Каждая часть — своя
схема. `createForm` собирает их в одну [сборку формы](/docs/reference/glossary).

## Когда нужно

Эта страница — карта. Найдите свою задачу и откройте страницу схемы.

| Задача                                              | Схема                   | Страница                                      |
| --------------------------------------------------- | ----------------------- | --------------------------------------------- |
| Какие поля есть, каким компонентом рисуется каждое  | схема формы             | [Схема формы](./form-schema.md)               |
| Что считается верным значением                      | схема валидации         | [Схема валидации](./validation-schema.md)     |
| Вычисляемые поля, условная доступность, копирование | схема поведения         | [Схема поведения](./behavior-schema.md)       |
| Форма из нескольких шагов                           | поток шагов             | [FormWizard](/docs/cdk/form-wizard)           |
| Форма приходит с сервера в JSON                     | документ схемы и реестр | [renderer-json](/docs/packages/renderer-json) |
| Одна группа полей повторяется в форме               | части схем              | [Повторяющиеся группы](./composition.md)      |

## Минимальный пример

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import { defineValidation, validate } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type Person = { firstName: string; lastName: string; fullName: string; email: string };

// Схема формы: поля и компоненты. Правил здесь нет.
const personSchema = (model: FormModel<Person>): FormSchemaNode => ({
  children: [
    { model: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
    { model: model.$.fullName, component: Input, disabled: true },
    { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
  ],
});

// Схема валидации: правила полей.
const personValidation = defineValidation<Person>(({ model }) => {
  validate(model.$.firstName, [required()]);
  validate(model.$.email, [required(), email()]);
});

// Схема поведения: как поля реагируют друг на друга.
const personBehavior = defineFormBehavior<Person>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (first, last) =>
    `${first} ${last}`.trim()
  );
});

const person = createForm<Person>({
  initial: { firstName: '', lastName: '', fullName: '', email: '' },
  schema: personSchema,
  validation: personValidation,
  behavior: personBehavior,
});
```

## Как схемы связаны

Все схемы указывают на поля одинаково — [сигналом поля](/docs/reference/glossary)
`model.$.<поле>`. По этому сигналу сборка находит ноду: замечание правила `validate(model.$.email, …)`
появится у `form.email`, а значение, которое пишет `compute`, — в поле `email` модели.

| Схема     | Поле                              | Массив строк                             | Повторяющаяся группа                  |
| --------- | --------------------------------- | ---------------------------------------- | ------------------------------------- |
| формы     | `{ model: model.$.x, component }` | `{ model: model.$.items, item }`         | `{ model: model.$.group, part }`      |
| валидации | `validate(model.$.x, rules)`      | `applyEach(model.$.items, itemRules)`    | `apply(model.$.group, groupRules)`    |
| поведения | `compute(model.$.x, …)`           | `applyEach(model.$.items, itemBehavior)` | `apply(model.$.group, groupBehavior)` |

Схемы не зависят друг от друга. Разметку можно поменять, не трогая правил, а одни и те же правила
подключить к форме из кода и к форме из JSON.

## Подводные камни

- **Правил в схеме формы нет.** Узел поля описывает только компонент и его пропсы. Правила пишут в
  схеме валидации.
- **Схема формы — функция `(model) => узел`.** Узлы держат сигналы полей, поэтому дерево строится
  после модели. Готовое дерево вместо функции `createForm` не примет.
- **Схему правил держите константой модуля.** Сборка отменяет устаревшие проверки по ссылке на
  схему. Схема, созданная заново при каждой перерисовке, этого не даёт.

## См. также

- [Схема формы](./form-schema.md) — узлы, контейнеры, массивы.
- [Схема валидации](./validation-schema.md) — формат правил и запуск проверки.
- [Схема поведения](./behavior-schema.md) — операторы и область поведения.
- [Повторяющиеся группы](./composition.md) — одна часть схемы на несколько групп.
