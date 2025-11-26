---
sidebar_position: 3
---

# Условная доступность

Включение и отключение полей с помощью `enableWhen` и `disableWhen`.

## Обзор

Условная доступность контролирует, активны или деактивированы поля формы в зависимости от значений других полей. Типичные случаи использования:

- Деактивировать поле города до выбора страны
- Активировать кнопку отправки только при принятии условий
- Деактивировать поля ипотеки, когда тип кредита не ипотека
- Деактивировать адрес проживания, когда отмечено "совпадает с регистрацией"

## enableWhen

Поведение `enableWhen` активирует поле, когда условие истинно, и деактивирует в противном случае.

```typescript
import { enableWhen } from 'reformer/behaviors';

enableWhen(
  field,      // Путь поля для управления
  condition,  // Функция, возвращающая true для активации, false для деактивации
  options     // Опционально: { resetOnDisable: boolean }
);
```

### Базовый пример: Активировать город при выборе страны

```typescript title="src/behaviors/address-behavior.ts"
import { enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface AddressForm {
  country: string;
  city: string;
}

export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
  // Город активен только когда выбрана страна
  enableWhen(path.city, (form) => Boolean(form.country), {
    resetOnDisable: true,
  });
};
```

### Множественные условия

```typescript title="src/behaviors/loan-behavior.ts"
interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed';
  // Поля ипотеки
  propertyValue: number;
  initialPayment: number;
  // Поля трудоустройства
  companyName: string;
  position: string;
  // Поля самозанятости
  businessType: string;
  businessInn: string;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Поля ипотеки - активны только для ипотеки
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // Поля трудоустройства - активны только для трудоустроенных
  enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.position, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });

  // Поля самозанятости - активны только для самозанятых
  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
};
```

### Активация групп

Можно активировать/деактивировать целые группы:

```typescript title="src/behaviors/contact-behavior.ts"
interface ContactForm {
  sameAsRegistration: boolean;
  residenceAddress: {
    city: string;
    street: string;
    house: string;
  };
}

export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path) => {
  // Деактивировать всю группу адреса проживания при совпадении с регистрацией
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });
};
```

## disableWhen

Поведение `disableWhen` — инверсия `enableWhen`: оно деактивирует поле, когда условие истинно.

```typescript
import { disableWhen } from 'reformer/behaviors';

disableWhen(
  field,      // Путь поля для управления
  condition,  // Функция, возвращающая true для деактивации, false для активации
  options     // Опционально: { resetOnDisable: boolean }
);
```

### Пример: Деактивация при подтверждении

```typescript title="src/behaviors/form-behavior.ts"
import { disableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface OrderForm {
  isConfirmed: boolean;
  productName: string;
  quantity: number;
  price: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
  // Деактивировать все поля при подтверждении заказа
  disableWhen(path.productName, (form) => form.isConfirmed === true);
  disableWhen(path.quantity, (form) => form.isConfirmed === true);
  disableWhen(path.price, (form) => form.isConfirmed === true);
};
```

### Режим только для чтения

```typescript title="src/behaviors/profile-behavior.ts"
interface ProfileForm {
  isEditing: boolean;
  firstName: string;
  lastName: string;
  email: string;
}

export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
  // Деактивировать поля, когда не в режиме редактирования
  disableWhen(path.firstName, (form) => !form.isEditing);
  disableWhen(path.lastName, (form) => !form.isEditing);
  disableWhen(path.email, (form) => !form.isEditing);
};
```

## Опция resetOnDisable

Опция `resetOnDisable` сбрасывает значение поля к начальному, когда поле становится неактивным:

```typescript
enableWhen(path.city, (form) => Boolean(form.country), {
  resetOnDisable: true,  // Сбросить город при очистке страны
});
```

Это важно для:
- Предотвращения отправки устаревших данных
- Обеспечения консистентности состояния формы
- Избежания ошибок валидации на скрытых/деактивированных полях

### Когда использовать resetOnDisable

```typescript
// ✅ Используйте resetOnDisable, когда поле зависит от родительского
enableWhen(path.carModel, (form) => Boolean(form.carBrand), {
  resetOnDisable: true,  // Очистить модель при смене марки
});

// ✅ Используйте resetOnDisable для условных секций
enableWhen(path.businessInfo, (form) => form.employmentStatus === 'selfEmployed', {
  resetOnDisable: true,  // Очистить бизнес-информацию когда не самозанятый
});

// ❌ Не используйте resetOnDisable для простого переключения без зависимости данных
disableWhen(path.notes, (form) => form.isConfirmed);
// Заметки должны сохраняться при переключении подтверждения
```

## Комбинирование с условным рендерингом

Для лучшего пользовательского опыта комбинируйте `enableWhen` с условным рендерингом:

```tsx title="src/components/LoanForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';

function LoanForm({ control }: LoanFormProps) {
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-4">
      <FormField control={control.loanType} />

      {/* Поля скрыты И деактивированы через enableWhen */}
      {loanType === 'mortgage' && (
        <div className="space-y-4">
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </div>
      )}
    </div>
  );
}
```

С поведением:

```typescript title="src/behaviors/loan-behavior.ts"
export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Даже если поля рендерятся условно,
  // enableWhen гарантирует их деактивацию и сброс когда неприменимы
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
};
```

## Состояние disabled в компонентах

Состояние `disabled` автоматически доступно через `useFormControl`:

```tsx title="src/components/ui/input.tsx"
import { useFormControl, type FieldNode } from 'reformer';

interface InputProps {
  control: FieldNode<string>;
  label: string;
}

export function Input({ control, label }: InputProps) {
  const { value, disabled, errors } = useFormControl(control);

  return (
    <div>
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
        className={disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
      />
      {errors.length > 0 && <span className="text-red-500">{errors[0].message}</span>}
    </div>
  );
}
```

## Сложные условия

### Множественные зависимости

```typescript
enableWhen(
  path.deliveryDate,
  (form) => form.hasDelivery && form.deliveryType === 'scheduled',
  { resetOnDisable: true }
);
```

### Числовые условия

```typescript
enableWhen(
  path.discountCode,
  (form) => form.orderTotal >= 100,
  { resetOnDisable: true }
);
```

### Условия по длине массива

```typescript
enableWhen(
  path.bulkDiscount,
  (form) => form.items.length >= 5,
  { resetOnDisable: true }
);
```

## Лучшие практики

### 1. Всегда учитывайте resetOnDisable

Решите, нужно ли сбрасывать значения при деактивации:

```typescript
// Данные зависят от родителя - используйте resetOnDisable
enableWhen(path.city, (form) => Boolean(form.region), {
  resetOnDisable: true,
});

// Простое переключение - не сбрасывайте
disableWhen(path.comments, (form) => form.isSubmitted);
```

### 2. Комбинируйте с условным рендерингом

Для скрытых полей используйте оба подхода:

```typescript
// Поведение управляет состоянием
enableWhen(path.optionalField, (form) => form.showOptional, {
  resetOnDisable: true,
});
```

```tsx
// Компонент управляет видимостью
{showOptional && <FormField control={control.optionalField} />}
```

### 3. Группируйте связанные поля

Применяйте одинаковое условие к связанным полям:

```typescript
const isMortgage = (form: LoanForm) => form.loanType === 'mortgage';

enableWhen(path.propertyValue, isMortgage, { resetOnDisable: true });
enableWhen(path.initialPayment, isMortgage, { resetOnDisable: true });
enableWhen(path.propertyType, isMortgage, { resetOnDisable: true });
```

### 4. Учитывайте валидацию

Деактивированные поля обычно пропускают валидацию. Убедитесь, что логика валидации это учитывает:

```typescript
// Валидация выполняется только когда поле активно
required(path.companyName, {
  message: 'Название компании обязательно для трудоустроенных'
});

// В сочетании с enableWhen
enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
  resetOnDisable: true,
});
```

## Следующий шаг

Теперь, когда вы понимаете включение и отключение полей, давайте узнаем о копировании и синхронизации значений между полями с помощью `copyFrom` и `syncFields`.
