---
sidebar_position: 4
---

# Кастомные валидаторы

Создание переиспользуемых валидаторов для вашего приложения.

## Простой кастомный валидатор

Кастомный валидатор — это чистая функция в массиве `validators` поля. Она получает
`(value, scope, root)` и возвращает `ValidationError` (`{ code, message, params? }`) либо `null`,
когда значение валидно:

```typescript
import { createModel, createForm } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ age: number }>({ age: 0 });

const schema = {
  age: {
    value: model.$.age,
    component: Input,
    // Инлайн кастомный валидатор
    validators: [
      (value: number) => (value < 18 ? { code: 'mustBeAdult', message: 'Только для 18+' } : null),
    ],
  },
};

const form = createForm({ model, schema });
// Ошибка: { code: 'mustBeAdult', message: 'Только для 18+' }
```

## Переиспользуемая фабрика валидаторов

```typescript
// validators/password.ts
import type { Validator } from '@reformer/core';

export function strongPassword(): Validator<unknown, string> {
  return (value) => {
    if (!value) return null;
    if (!/[A-Z]/.test(value)) return { code: 'noUppercase', message: 'Нужна заглавная буква' };
    if (!/[a-z]/.test(value)) return { code: 'noLowercase', message: 'Нужна строчная буква' };
    if (!/[0-9]/.test(value)) return { code: 'noNumber', message: 'Нужна цифра' };
    if (value.length < 8) return { code: 'tooShort', message: 'Минимум 8 символов' };
    return null;
  };
}

// Использование — внутри схемы формы:
password: {
  value: model.$.password,
  component: Input,
  validators: [required(), strongPassword()],
},
```

## Валидатор с параметрами

Структурированные данные ошибки передавайте через `params`:

```typescript
import type { Validator } from '@reformer/core';

export function range(min: number, max: number): Validator<unknown, number> {
  return (value) => {
    if (value < min || value > max) {
      return { code: 'range', message: `Значение вне диапазона`, params: { min, max, actual: value } };
    }
    return null;
  };
}

// Использование — внутри схемы формы:
quantity: {
  value: model.$.quantity,
  component: Input,
  validators: [range(1, 100)],
},
// Ошибка: { code: 'range', message: '...', params: { min: 1, max: 100, actual: 150 } }
```

## Валидатор с контекстом

Доступ к состоянию формы во время валидации. Третий аргумент `root` — модель формы; чтение
`root.someField` возвращает текущее значение этого поля:

```typescript
import type { ModelValidator } from '@reformer/core';

export function matchField(fieldName: string): ModelValidator<unknown, unknown, Record<string, unknown>> {
  return (value, _scope, root) => {
    const otherValue = root[fieldName];

    if (value !== otherValue) {
      return { code: 'mismatch', message: 'Значения не совпадают', params: { field: fieldName } };
    }
    return null;
  };
}

// Использование — внутри схемы формы:
confirmPassword: {
  value: model.$.confirmPassword,
  component: Input,
  validators: [matchField('password')],
},
```

## Кросс-валидация полей

Валидация связей между полями. Правило вешается на поле-носитель ошибки и читает соседей через
`root`:

```typescript
import type { ModelValidator } from '@reformer/core';

// Валидация, что дата окончания после даты начала
const endAfterStart: ModelValidator<string, unknown, { startDate: string }> = (value, _scope, root) => {
  const startDate = root.startDate;

  if (value && startDate && new Date(value) < new Date(startDate)) {
    return { code: 'endBeforeStart', message: 'Дата окончания должна быть позже начала' };
  }
  return null;
};

// Внутри схемы формы:
startDate: { value: model.$.startDate, component: Input, validators: [required()] },
endDate: { value: model.$.endDate, component: Input, validators: [required(), endAfterStart] },
```

## Валидация элементов массива

Валидация элементов в динамических массивах. Секция массива объявляется узлом
`{ array: model.<path>, item: (itemModel) => subSchema }`:

```typescript
import { createModel, createForm, type FormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type ContactForm = {
  name: string;
  emails: { address: string }[];
};

const model = createModel<ContactForm>({
  name: '',
  emails: [{ address: '' }],
});

// Под-схема одного элемента массива
const emailItem = (item: FormModel<{ address: string }>) => ({
  address: {
    value: item.$.address,
    component: Input,
    // Валидация каждого email в массиве
    validators: [required(), email()],
  },
});

const schema = {
  name: { value: model.$.name, component: Input, validators: [required()] },
  emails: { array: model.emails, item: emailItem },
};

const form = createForm<ContactForm>({ model, schema });
```

## Условная валидация с кастомной логикой

Используйте branch-узел (`{ when, children }`) для условных кастомных валидаторов. Когда `when`
ложно, поддерево пропускается, а его ошибки очищаются:

```typescript
import { validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const isNineDigits = (value: string) =>
  /^\d{9}$/.test(value) ? null : { code: 'invalidTaxId', message: 'Tax ID из 9 цифр' };

const schema = {
  children: [
    { value: model.$.country, component: Input, validators: [required()] },
    {
      // Требовать tax ID только для пользователей из США
      when: (_scope, root) => root.country === 'US',
      children: [
        {
          value: model.$.taxId,
          component: Input,
          validators: [required(), isNineDigits],
        },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Следующие шаги

- [Behaviors](/docs/behaviors/overview) — реактивная логика форм
- [API Reference](/docs/api) — полная документация API
  </content>
