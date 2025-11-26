---
sidebar_position: 4
---

# Копирование и синхронизация

Копирование и синхронизация значений полей с помощью `copyFrom` и `syncFields`.

## Обзор

Поведения копирования и синхронизации автоматизируют передачу данных между полями формы:

- **copyFrom** — Односторонее копирование из источника в цель по условию
- **syncFields** — Двусторонняя синхронизация между полями

Типичные случаи использования:
- Копировать адрес регистрации в адрес проживания
- Синхронизировать адреса доставки и оплаты
- Копировать email в дополнительный email

## copyFrom

Поведение `copyFrom` копирует значения из поля-источника в целевое поле, когда выполняется условие.

```typescript
import { copyFrom } from 'reformer/behaviors';

copyFrom(
  targetField,  // Поле, КУДА копировать
  sourceField,  // Поле, ОТКУДА копировать
  options       // { when: condition, fields?: 'all' | string[] }
);
```

### Базовый пример: Копирование адреса

```typescript title="src/behaviors/address-behavior.ts"
import { copyFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface ContactForm {
  sameAsRegistration: boolean;
  registrationAddress: {
    city: string;
    street: string;
    house: string;
    postalCode: string;
  };
  residenceAddress: {
    city: string;
    street: string;
    house: string;
    postalCode: string;
  };
}

export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path: FieldPath<ContactForm>) => {
  // Копировать адрес регистрации в адрес проживания при установке чекбокса
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });
};
```

### Копирование одного поля

```typescript title="src/behaviors/email-behavior.ts"
interface EmailForm {
  sameEmail: boolean;
  email: string;
  emailAdditional: string;
}

export const emailBehavior: BehaviorSchemaFn<EmailForm> = (path) => {
  // Копировать основной email в дополнительный
  copyFrom(path.emailAdditional, path.email, {
    when: (form) => form.sameEmail === true,
  });
};
```

### Копирование конкретных полей

Можно указать, какие именно поля копировать из группы:

```typescript title="src/behaviors/billing-behavior.ts"
interface OrderForm {
  useShippingAsBilling: boolean;
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    postalCode: string;
    phone: string;
  };
  billingAddress: {
    name: string;
    street: string;
    city: string;
    postalCode: string;
    phone: string;
  };
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Копировать только поля адреса, не телефон
  copyFrom(path.billingAddress, path.shippingAddress, {
    when: (form) => form.useShippingAsBilling === true,
    fields: ['street', 'city', 'postalCode'], // Только эти поля
  });
};
```

### Комбинирование с enableWhen

Для полного паттерна "совпадает с" комбинируйте `copyFrom` с `enableWhen`:

```typescript title="src/behaviors/full-address-behavior.ts"
import { copyFrom, enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';

interface AddressForm {
  sameAsRegistration: boolean;
  registrationAddress: Address;
  residenceAddress: Address;
}

export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  // Копировать при установке чекбокса
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // Деактивировать адрес проживания когда совпадает с регистрацией
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });
};
```

## syncFields

Поведение `syncFields` создаёт двустороннюю синхронизацию между двумя полями — при изменении любого из них обновляется другое.

```typescript
import { syncFields } from 'reformer/behaviors';

syncFields(
  field1,  // Первое поле
  field2   // Второе поле (синхронизировано с первым)
);
```

### Базовый пример: Синхронизация двух полей

```typescript title="src/behaviors/sync-behavior.ts"
import { syncFields, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface DemoForm {
  field1: string;
  field2: string;
}

export const demoBehavior: BehaviorSchemaFn<DemoForm> = (path: FieldPath<DemoForm>) => {
  // Изменения field1 обновляют field2, и наоборот
  syncFields(path.field1, path.field2);
};
```

### Синхронизация имени пользователя и отображаемого имени

```typescript title="src/behaviors/user-behavior.ts"
interface UserForm {
  username: string;
  displayName: string;
  allowDifferentDisplayName: boolean;
}

export const userBehavior: BehaviorSchemaFn<UserForm> = (path) => {
  // Синхронизировать только когда allowDifferentDisplayName = false
  // Примечание: для условной синхронизации используйте watchField
};
```

## Практические примеры

### Полная реализация "Совпадает с адресом"

```tsx title="src/components/AddressSection.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { AddressForm } from '../nested-forms/AddressForm';

function AddressSection({ control }: AddressSectionProps) {
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  return (
    <div className="space-y-6">
      {/* Адрес регистрации */}
      <div className="space-y-4">
        <h3 className="font-semibold">Адрес регистрации</h3>
        <AddressForm control={control.registrationAddress} />
      </div>

      {/* Чекбокс "Совпадает с регистрацией" */}
      <FormField control={control.sameAsRegistration} />

      {/* Адрес проживания — скрыт если совпадает */}
      {!sameAsRegistration && (
        <div className="space-y-4">
          <h3 className="font-semibold">Адрес проживания</h3>
          <AddressForm control={control.residenceAddress} />
        </div>
      )}

      {/* Показать информацию о копировании */}
      {sameAsRegistration && (
        <div className="p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">
            Адрес проживания совпадает с адресом регистрации
          </p>
        </div>
      )}
    </div>
  );
}
```

С поведением:

```typescript title="src/behaviors/address-behavior.ts"
export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });
};
```

### Копирование с трансформацией

Для копирования с трансформацией используйте `watchField`:

```typescript title="src/behaviors/transform-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';

interface FormWithTransform {
  sourceValue: string;
  uppercaseValue: string;
}

export const transformBehavior: BehaviorSchemaFn<FormWithTransform> = (path) => {
  // Копирование с трансформацией
  watchField(path.sourceValue, (value, ctx) => {
    ctx.form.uppercaseValue.setValue(value?.toUpperCase() || '');
  });
};
```

### Условное копирование по значению

```typescript title="src/behaviors/conditional-copy-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';

interface OrderForm {
  orderType: 'standard' | 'rush' | 'express';
  standardPrice: number;
  rushPrice: number;
  expressPrice: number;
  finalPrice: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Копировать разную цену в зависимости от типа заказа
  watchField(path.orderType, (orderType, ctx) => {
    switch (orderType) {
      case 'standard':
        ctx.form.finalPrice.setValue(ctx.form.standardPrice.getValue());
        break;
      case 'rush':
        ctx.form.finalPrice.setValue(ctx.form.rushPrice.getValue());
        break;
      case 'express':
        ctx.form.finalPrice.setValue(ctx.form.expressPrice.getValue());
        break;
    }
  });
};
```

## Когда использовать каждое поведение

| Поведение | Когда использовать |
|-----------|-------------------|
| `copyFrom` | Одностороннее копирование по чекбоксу/условию |
| `syncFields` | Двусторонняя синхронизация всегда активна |
| `watchField` | Копирование с трансформацией или сложной логикой |
| `computeFrom` | Производное значение из нескольких источников |

## Лучшие практики

### 1. Комбинируйте с enableWhen для паттерна "Совпадает с"

```typescript
// Копировать при установке чекбокса
copyFrom(path.target, path.source, {
  when: (form) => form.sameAsSource === true,
  fields: 'all',
});

// Деактивировать цель при копировании
enableWhen(path.target, (form) => form.sameAsSource === false, {
  resetOnDisable: true,
});
```

### 2. Используйте условный рендеринг

Скрывайте целевое поле при копировании, чтобы избежать путаницы:

```tsx
{!sameAsSource && <FormField control={control.target} />}
```

### 3. Учитывайте типы полей

При копировании групп убедитесь, что источник и цель имеют одинаковую структуру:

```typescript
// ✅ Одинаковая структура
copyFrom(path.billingAddress, path.shippingAddress, { ... });

// ❌ Разные структуры вызовут проблемы
// copyFrom(path.simpleField, path.complexGroup, { ... });
```

### 4. Осторожно работайте с массивами

Массивы требуют особой обработки — используйте `watchField` для большего контроля:

```typescript
watchField(path.sourceArray, (sourceItems, ctx) => {
  // Очистить и заново заполнить целевой массив
  ctx.form.targetArray.clear();
  sourceItems.forEach(item => {
    ctx.form.targetArray.push();
    // Установить значения для каждого элемента
  });
}, { immediate: false });
```

## Следующий шаг

Теперь, когда вы понимаете копирование и синхронизацию полей, давайте узнаем об отслеживании изменений полей с помощью `watchField`.
