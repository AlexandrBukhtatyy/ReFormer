---
sidebar_position: 1
---

# Обзор Behaviors

Behaviors добавляют реактивную логику в формы: вычисляемые поля, условную видимость, синхронизацию полей.

## Что такое Behaviors?

Behaviors автоматически реагируют на изменения в форме:

```typescript
import { GroupNode } from 'reformer';
import { computeFrom, enableWhen } from 'reformer/behaviors';

const form = new GroupNode({
  form: {
    price: { value: 100 },
    quantity: { value: 1 },
    total: { value: 0 },
    discount: { value: 0 },
    showDiscount: { value: false },
  },
  behavior: (path) => {
    // Автовычисление total
    computeFrom([path.price, path.quantity], path.total, ({ price, quantity }) => price * quantity);

    // Условное включение поля скидки
    enableWhen(path.discount, (form) => form.total > 500);
  },
});
```

## Доступные Behaviors

| Behavior                                                    | Описание                             |
| ----------------------------------------------------------- | ------------------------------------ |
| [`computeFrom`](/docs/behaviors/computed#computefrom)       | Вычисление поля из других полей      |
| [`transformValue`](/docs/behaviors/computed#transformvalue) | Трансформация значения при изменении |
| [`enableWhen`](/docs/behaviors/conditional#enablewhen)      | Условное включение/отключение        |
| [`resetWhen`](/docs/behaviors/conditional#resetwhen)        | Сброс поля по условию                |
| [`copyFrom`](/docs/behaviors/sync#copyfrom)                 | Копирование значения из другого поля |
| [`syncFields`](/docs/behaviors/sync#syncfields)             | Двусторонняя синхронизация           |
| [`watchField`](/docs/behaviors/watch#watchfield)            | Реакция на изменения поля            |
| [`revalidateWhen`](/docs/behaviors/watch#revalidatewhen)    | Запуск повторной валидации           |

## Как работают Behaviors

1. Определяются в `behavior`
2. ReFormer настраивает реактивные подписки
3. При изменении исходных полей behavior выполняется автоматически

```typescript
// Когда price или quantity меняется → total обновляется
computeFrom(
  [path.price, path.quantity], // Отслеживать эти
  path.total, // Обновить это
  ({ price, quantity }) => price * quantity // Этой функцией
);
```

## Behavior vs Validation

| Аспект    | Валидация              | Behavior                     |
| --------- | ---------------------- | ---------------------------- |
| Цель      | Проверка корректности  | Реакция на изменения         |
| Результат | Ошибки                 | Побочные эффекты             |
| Примеры   | Required, формат email | Вычисляемый total, show/hide |

## Следующие шаги

- [Вычисляемые поля](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Условная логика](/docs/behaviors/conditional) — `enableWhen`, `enableWhen`, `resetWhen`
- [Синхронизация](/docs/behaviors/sync) — `copyFrom`, `syncFields`
