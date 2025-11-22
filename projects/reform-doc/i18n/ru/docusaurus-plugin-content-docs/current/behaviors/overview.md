---
sidebar_position: 1
---

# Обзор Behaviors

Behaviors добавляют реактивную логику в формы: вычисляемые поля, условную видимость, синхронизацию полей.

## Что такое Behaviors?

Behaviors автоматически реагируют на изменения в форме:

```typescript
import { GroupNode, FieldNode } from 'reformer';
import { computeFrom, showWhen } from 'reformer/behaviors';

const form = new GroupNode({
  schema: {
    price: new FieldNode({ value: 100 }),
    quantity: new FieldNode({ value: 1 }),
    total: new FieldNode({ value: 0 }),
    discount: new FieldNode({ value: 0 }),
    showDiscount: new FieldNode({ value: false }),
  },
  behaviorSchema: (path, ctx) => [
    // Автовычисление total
    computeFrom(
      [path.price, path.quantity],
      path.total,
      (price, qty) => price * qty
    ),

    // Условное отображение поля скидки
    showWhen(
      path.showDiscount,
      () => form.controls.total.value > 500
    ),
  ],
});
```

## Доступные Behaviors

| Behavior | Описание |
|----------|----------|
| [`computeFrom`](/docs/behaviors/computed#computefrom) | Вычисление поля из других полей |
| [`transformValue`](/docs/behaviors/computed#transformvalue) | Трансформация значения при изменении |
| [`showWhen`](/docs/behaviors/conditional#showwhen) | Условная видимость |
| [`enableWhen`](/docs/behaviors/conditional#enablewhen) | Условное включение/отключение |
| [`resetWhen`](/docs/behaviors/conditional#resetwhen) | Сброс поля по условию |
| [`copyFrom`](/docs/behaviors/sync#copyfrom) | Копирование значения из другого поля |
| [`syncFields`](/docs/behaviors/sync#syncfields) | Двусторонняя синхронизация |
| [`watchField`](/docs/behaviors/watch#watchfield) | Реакция на изменения поля |
| [`revalidateWhen`](/docs/behaviors/watch#revalidatewhen) | Запуск повторной валидации |

## Как работают Behaviors

1. Определяются в `behaviorSchema`
2. ReFormer настраивает реактивные подписки
3. При изменении исходных полей behavior выполняется автоматически

```typescript
// Когда price или quantity меняется → total обновляется
computeFrom(
  [path.price, path.quantity],  // Отслеживать эти
  path.total,                    // Обновить это
  (price, qty) => price * qty    // Этой функцией
)
```

## Behavior vs Validation

| Аспект | Валидация | Behavior |
|--------|-----------|----------|
| Цель | Проверка корректности | Реакция на изменения |
| Результат | Ошибки | Побочные эффекты |
| Примеры | Required, формат email | Вычисляемый total, show/hide |

## Следующие шаги

- [Вычисляемые поля](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Условная логика](/docs/behaviors/conditional) — `showWhen`, `enableWhen`, `resetWhen`
- [Синхронизация](/docs/behaviors/sync) — `copyFrom`, `syncFields`
