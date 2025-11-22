---
sidebar_position: 1
slug: /
---

# Введение

**ReFormer** — это реактивная библиотека для работы с формами, построенная на [Preact Signals](https://preactjs.com/guide/v10/signals/). Она предоставляет декларативный способ создания сложных форм с валидацией, вычисляемыми полями и условной логикой.

## Ключевые возможности

- **Реактивное состояние** — построено на Signals для точечной реактивности
- **Типобезопасность** — полная поддержка TypeScript с выводом типов
- **Декларативная валидация** — встроенные валидаторы + поддержка кастомной валидации
- **Behaviors** — вычисляемые поля, условная видимость, синхронизация полей
- **Вложенные формы** — поддержка сложных вложенных структур и динамических массивов
- **Фреймворк-агностик** — ядро работает где угодно, React-биндинги включены

## Быстрый пример

```typescript
import { GroupNode, FieldNode } from 'reformer';
import { required, email } from 'reformer/validators';

// Определяем структуру формы
const form = new GroupNode({
  schema: {
    name: new FieldNode({ value: '' }),
    email: new FieldNode({ value: '' }),
  },
  validationSchema: (path, { validate }) => [
    validate(path.name, required()),
    validate(path.email, required(), email()),
  ],
});

// Реагируем на изменения
form.value; // { name: '', email: '' }
form.controls.name.setValue('John');
form.value; // { name: 'John', email: '' }
```

## Основные концепции

| Концепция | Описание |
|-----------|----------|
| [**Nodes**](/docs/core-concepts/nodes) | Строительные блоки: `FieldNode`, `GroupNode`, `ArrayNode` |
| [**Валидация**](/docs/validation/overview) | Встроенные валидаторы и кастомная валидация |
| [**Behaviors**](/docs/behaviors/overview) | Реактивная логика: вычисляемые поля, условная видимость |

## Следующие шаги

- [Установка](/docs/getting-started/installation) — добавьте ReFormer в проект
- [Быстрый старт](/docs/getting-started/quick-start) — создайте первую форму
- [API Reference](/docs/api) — полная документация API
