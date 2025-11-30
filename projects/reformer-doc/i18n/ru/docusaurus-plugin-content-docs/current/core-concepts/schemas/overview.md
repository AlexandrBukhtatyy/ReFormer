---
sidebar_position: 1
---

# Обзор схем

ReFormer использует архитектуру из трёх схем для разделения ответственности и максимального переиспользования кода.

## Три типа схем

| Схема | Назначение | Свойство |
|-------|------------|----------|
| **Схема формы** | Структура данных и конфигурация полей | `form` |
| **Схема валидации** | Правила валидации | `validation` |
| **Схема поведений** | Реактивная логика и побочные эффекты | `behavior` |

```typescript
import { GroupNode } from 'reformer';
import { required, email } from 'reformer/validators';
import { computeFrom } from 'reformer/behaviors';

const form = new GroupNode({
  // 1. Схема формы - структура
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
    fullName: { value: '' },
    email: { value: '' },
  },

  // 2. Схема валидации - правила
  validation: (path) => {
    required(path.firstName);
    required(path.lastName);
    required(path.email);
    email(path.email);
  },

  // 3. Схема поведений - логика
  behavior: (path) => {
    computeFrom(
      [path.firstName, path.lastName],
      path.fullName,
      ({ firstName, lastName }) => `${firstName} ${lastName}`.trim()
    );
  },
});
```

## Зачем три схемы?

### Разделение ответственности

Каждая схема имеет одну зону ответственности:

- **Схема формы**: «Какие данные мы собираем?»
- **Схема валидации**: «Корректны ли данные?»
- **Схема поведений**: «Как данные должны реагировать на изменения?»

### Переиспользование

Каждую схему можно извлечь и переиспользовать независимо:

```typescript
// Переиспользуемый набор валидации
export function validatePerson(path: FieldPath<Person>) {
  required(path.firstName);
  required(path.lastName);
  email(path.email);
}

// Использование в нескольких формах
const form1 = new GroupNode({
  form: { person: personSchema() },
  validation: (path) => validatePerson(path.person),
});

const form2 = new GroupNode({
  form: { user: personSchema() },
  validation: (path) => validatePerson(path.user),
});
```

### Тестируемость

Тестируйте каждую схему изолированно:

```typescript
// Тестирование валидации отдельно
describe('validatePerson', () => {
  it('требует firstName', () => {
    const form = new GroupNode({
      form: personSchema(),
      validation: validatePerson,
    });
    expect(form.controls.firstName.errors).toEqual({ required: true });
  });
});
```

### Типобезопасность

Все три схемы используют `FieldPath<T>` для проверки типов на этапе компиляции:

```typescript
validation: (path) => {
  required(path.firstName);   // ✅ TypeScript знает, что это поле существует
  required(path.middleName);  // ❌ Ошибка: 'middleName' не существует
}
```

## Структура схем

```
Конфигурация GroupNode
├── form: FormSchema<T>           → Структура данных
├── validation: ValidationSchemaFn<T>  → Правила валидации
└── behavior: BehaviorSchemaFn<T>      → Реактивная логика
```

## Следующие шаги

- [Схема формы](./form-schema) — Структура и конфигурация полей
- [Схема валидации](./validation-schema) — Правила валидации
- [Схема поведений](./behavior-schema) — Реактивная логика
- [Композиция](./composition) — Паттерны переиспользования и декомпозиции
