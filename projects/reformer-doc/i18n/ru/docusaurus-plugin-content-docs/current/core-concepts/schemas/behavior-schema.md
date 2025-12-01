---
sidebar_position: 4
---

# Схема поведений

Схема поведений определяет реактивную логику и побочные эффекты для формы.

## Тип BehaviorSchemaFn

```typescript
type BehaviorSchemaFn<T> = (path: FieldPath<T>) => void;
```

Функция поведений получает типобезопасный объект `path` для объявления реактивных поведений:

```typescript
import { GroupNode } from 'reformer';
import { computeFrom, enableWhen } from 'reformer/behaviors';

const form = new GroupNode({
  form: {
    price: { value: 100 },
    quantity: { value: 1 },
    total: { value: 0 },
    discount: { value: 0 },
  },
  behavior: (path) => {
    // Автовычисление итога
    computeFrom(
      [path.price, path.quantity],
      path.total,
      ({ price, quantity }) => price * quantity
    );

    // Включить скидку только для крупных заказов
    enableWhen(path.discount, (form) => form.total > 500);
  },
});
```

## Доступные поведения

| Поведение | Тип | Описание |
|-----------|-----|----------|
| `computeFrom` | Вычисляемое | Вычислить поле из других полей |
| `transformValue` | Вычисляемое | Трансформировать значение при изменении |
| `enableWhen` | Условное | Включить/отключить по условию |
| `resetWhen` | Условное | Сбросить поле при выполнении условия |
| `copyFrom` | Синхронизация | Копировать значение из другого поля |
| `syncFields` | Синхронизация | Двусторонняя синхронизация полей |
| `watchField` | Наблюдение | Реагировать на изменения поля |
| `revalidateWhen` | Наблюдение | Запустить ревалидацию |

## Вычисляемые поведения

### computeFrom

Вычисление значения поля из других полей:

```typescript
import { computeFrom } from 'reformer/behaviors';

behavior: (path) => {
  // Один источник
  computeFrom(
    [path.firstName],
    path.initials,
    ({ firstName }) => firstName.charAt(0).toUpperCase()
  );

  // Несколько источников
  computeFrom(
    [path.firstName, path.lastName],
    path.fullName,
    ({ firstName, lastName }) => `${firstName} ${lastName}`.trim()
  );
}
```

### transformValue

Трансформация значения при изменении:

```typescript
import { transformValue } from 'reformer/behaviors';

behavior: (path) => {
  // Приведение к нижнему регистру
  transformValue(path.username, (value) => value.toLowerCase());

  // Форматирование номера телефона
  transformValue(path.phone, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
}
```

## Условные поведения

### enableWhen

Включение или отключение поля по условию:

```typescript
import { enableWhen } from 'reformer/behaviors';

behavior: (path) => {
  // Включить адрес доставки, если не совпадает с платёжным
  enableWhen(
    path.shippingAddress,
    (form) => !form.sameAsBilling
  );

  // Включить скидку для премиум-пользователей
  enableWhen(
    path.discount,
    (form) => form.userType === 'premium'
  );
}
```

### resetWhen

Сброс поля при выполнении условия:

```typescript
import { resetWhen } from 'reformer/behaviors';

behavior: (path) => {
  // Сбросить доставку при выборе «совпадает с платёжным»
  resetWhen(
    path.shippingAddress,
    (form) => form.sameAsBilling === true
  );
}
```

## Синхронизация полей

### copyFrom

Копирование значения из другого поля:

```typescript
import { copyFrom } from 'reformer/behaviors';

behavior: (path) => {
  // Копировать платёжный адрес в доставку при установке чекбокса
  copyFrom(
    path.billingAddress,
    path.shippingAddress,
    { when: (form) => form.sameAsBilling }
  );
}
```

### syncFields

Двусторонняя синхронизация:

```typescript
import { syncFields } from 'reformer/behaviors';

behavior: (path) => {
  // Синхронизация email-полей (изменение любого обновляет оба)
  syncFields(path.email, path.confirmEmail);
}
```

## Наблюдение за изменениями

### watchField

Реакция на изменения поля:

```typescript
import { watchField } from 'reformer/behaviors';

behavior: (path) => {
  watchField(path.country, (value, ctx) => {
    // Загрузить регионы для выбранной страны
    loadStates(value).then(states => {
      ctx.form.stateOptions.setValue(states);
    });
  });
}
```

### revalidateWhen

Запуск ревалидации при изменении другого поля:

```typescript
import { revalidateWhen } from 'reformer/behaviors';

behavior: (path) => {
  // Ревалидировать подтверждение пароля при изменении пароля
  revalidateWhen(path.password, path.confirmPassword);
}
```

## Извлечение наборов поведений

Создавайте переиспользуемые функции поведений:

```typescript
import { FieldPath, Behavior } from 'reformer';
import { computeFrom, transformValue } from 'reformer/behaviors';

// Переиспользуемые поведения для адреса
export function addressBehaviors<T extends { address: Address }>(
  path: FieldPath<T>
) {
  // Автоформатирование почтового индекса
  transformValue(path.address.zipCode, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}

// Использование
const form = new GroupNode({
  form: {
    billing: addressSchema(),
    shipping: addressSchema(),
  },
  behavior: (path) => {
    addressBehaviors(path.billing);
    addressBehaviors(path.shipping);
  },
});
```

## Поведение vs Валидация

| Аспект | Валидация | Поведение |
|--------|-----------|-----------|
| **Назначение** | Проверка корректности | Реакция на изменения |
| **Результат** | Ошибки | Побочные эффекты |
| **Когда срабатывает** | После изменения значения | После изменения значения |
| **Примеры** | Required, формат email | Вычисляемый итог, показать/скрыть |

## Следующие шаги

- [Обзор поведений](/docs/behaviors/overview) — Подробное руководство
- [Вычисляемые поля](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Условная логика](/docs/behaviors/conditional) — `enableWhen`, `resetWhen`
- [Композиция](./composition) — Переиспользование наборов поведений
