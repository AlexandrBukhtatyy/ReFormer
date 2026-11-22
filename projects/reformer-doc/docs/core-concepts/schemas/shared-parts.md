---
sidebar_position: 6
---

# Общие поля и правила

Куски, которые повторяются между формами, — поле email, правила для имени, проверка индекса, —
выносят в обычные функции и константы. Каждая форма подключает их к своим полям.

## Когда нужно

- В нескольких формах одно и то же поле с тем же компонентом и пропсами.
- Одни и те же правила проверяют разные поля.
- Форма бывает в нескольких вариантах: например, с отчеством и без.

Если в одной форме повторяется целая группа полей, удобнее подключить её частью — см.
[Повторяющиеся группы](./composition.md).

## Минимальный пример

```typescript title="shared/email.ts"
import type { FormSchemaNode, PathAwareSignal } from '@reformer/core';
import type { Rule } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

// Разметка поля — функция от сигнала поля.
export const emailField = (field: PathAwareSignal<string>): FormSchemaNode => ({
  model: field,
  component: Input,
  componentProps: { label: 'Email', type: 'email' },
});

// Правила — обычный массив.
export const emailRules: Rule<string>[] = [required(), email()];
```

```typescript title="forms/profile.ts"
import { createForm } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { emailField, emailRules } from '../shared/email';

type Profile = { email: string; backupEmail: string };

const profileValidation = defineValidation<Profile>(({ model }) => {
  validate(model.$.email, emailRules);
  validate(model.$.backupEmail, emailRules);
});

export const createProfileForm = () =>
  createForm<Profile>({
    initial: { email: '', backupEmail: '' },
    schema: (model) => ({ children: [emailField(model.$.email), emailField(model.$.backupEmail)] }),
    validation: profileValidation,
  });
```

## Поле — функция от сигнала поля

Функция получает [сигнал поля](/docs/reference/glossary) и возвращает узел схемы. В узле — только
компонент и пропсы. Начальное значение поля задаёт модель, правила — схема валидации.

```typescript
import type { FormSchemaNode, PathAwareSignal } from '@reformer/core';
import { CheckboxWithLabel, Input } from '@reformer/ui-kit';

export const phoneField = (field: PathAwareSignal<string>): FormSchemaNode => ({
  model: field,
  component: Input,
  componentProps: { label: 'Телефон', type: 'tel' },
});

export const consentField = (field: PathAwareSignal<boolean>): FormSchemaNode => ({
  model: field,
  component: CheckboxWithLabel,
  componentProps: { label: 'Согласен с условиями' },
});
```

## Набор правил — массив

Список правил — обычное значение. Если текст замечания должен зависеть от поля, дайте правилам свой
код, а текст положите в словарь сообщений формы (см. [Обзор валидации](/docs/validation/overview)).

```typescript
import type { Rule } from '@reformer/core/validation';
import { maxLength, minLength, required } from '@reformer/core/validators';

// Код замечания — по имени поля: 'firstName.required', 'lastName.minLength'…
export const nameRules = (field: string): Rule<string>[] => [
  required({ code: `${field}.required` }),
  minLength(2, { code: `${field}.minLength` }),
  maxLength(50, { code: `${field}.maxLength` }),
];
```

```typescript
validate(model.$.firstName, nameRules('firstName'));
validate(model.$.lastName, nameRules('lastName'));
```

## Несколько схем над одной моделью

Большую схему правил можно разбить на части над тем же типом и собрать оператором `apply`:

```typescript
import { apply, defineValidation, validate } from '@reformer/core/validation';
import { email, required } from '@reformer/core/validators';

type Signup = { name: string; email: string; agree: boolean };

const contactRules = defineValidation<Signup>(({ model }) => {
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});

const consentRules = defineValidation<Signup>(({ model }) => {
  validate(model.$.agree, [(value) => (value ? null : { code: 'agree.required' })]);
});

export const signupRules = defineValidation<Signup>(() => apply(contactRules, consentRules));
```

## Настраиваемые схемы

Если форма бывает в нескольких вариантах, разметку и правила создают функциями с одними и теми же
опциями:

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type Person = { firstName: string; middleName: string; lastName: string };
type PersonOptions = { withMiddleName?: boolean };

export const personPart =
  (options: PersonOptions = {}) =>
  (m: FormModel<Person>): FormSchemaNode => ({
    children: [
      { model: m.$.firstName, component: Input, componentProps: { label: 'Имя' } },
      ...(options.withMiddleName
        ? [{ model: m.$.middleName, component: Input, componentProps: { label: 'Отчество' } }]
        : []),
      { model: m.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
    ],
  });

export const personRules = (options: PersonOptions = {}) =>
  defineValidation<Person>(({ model }) => {
    validate(model.$.firstName, [required()]);
    validate(model.$.lastName, [required()]);
    if (options.withMiddleName) validate(model.$.middleName, [required()]);
  });

// Создаём один раз, на уровне модуля, и передаём в сборку готовые значения.
const fullPersonPart = personPart({ withMiddleName: true });
const fullPersonRules = personRules({ withMiddleName: true });
```

Модель хранит все поля в любом варианте. Опция решает только, показывать ли поле и проверять ли его.

## Подводные камни

- **Схему правил создавайте один раз.** `personRules(...)` возвращает новую схему при каждом вызове.
  Сборка отменяет устаревшие проверки по ссылке на схему, поэтому вызывайте фабрику на уровне
  модуля, а не в компоненте.
- **Значения по умолчанию — в модели.** Функция поля не знает начального значения: его задают в
  `initial` или в модели.
- **Тип правила — по типу поля.** Набор `Rule<string>[]` не подключить к числовому полю: TypeScript
  покажет ошибку. Для поля `number | null` объявляйте `Rule<number | null>[]`.

## См. также

- [Повторяющиеся группы](./composition.md) — одна группа полей в нескольких местах формы.
- [Модуль группы](./modules.md) — разметка, правила и поведение группы в одной папке.
- [Схема валидации](./validation-schema.md) — операторы `validate` и `apply`.
- [Кастомные валидаторы](/docs/validation/custom) — свои правила.
