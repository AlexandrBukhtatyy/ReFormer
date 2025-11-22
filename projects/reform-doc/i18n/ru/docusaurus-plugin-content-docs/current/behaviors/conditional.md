---
sidebar_position: 3
---

# Условная логика

Показ, скрытие, включение или отключение полей на основе условий.

## showWhen

Показывать поле только когда условие истинно.

```typescript
import { showWhen } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  showWhen(
    path.otherIncome,
    () => form.controls.hasOtherIncome.value === true
  ),
]
```

### Пример: Предпочтения контакта

```typescript
const form = new GroupNode({
  schema: {
    contactMethod: new FieldNode({ value: 'email' }),
    email: new FieldNode({ value: '' }),
    phone: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    showWhen(path.email, () =>
      form.controls.contactMethod.value === 'email'
    ),
    showWhen(path.phone, () =>
      form.controls.contactMethod.value === 'phone'
    ),
  ],
});
```

### Использование в React

```tsx
function ContactForm() {
  const email = useFormControl(form.controls.email);
  const phone = useFormControl(form.controls.phone);

  return (
    <form>
      <select {...bindSelect(form.controls.contactMethod)}>
        <option value="email">Email</option>
        <option value="phone">Телефон</option>
      </select>

      {email.visible && <input {...bindInput(email)} />}
      {phone.visible && <input {...bindInput(phone)} />}
    </form>
  );
}
```

## enableWhen

Включать поле только когда условие истинно.

```typescript
import { enableWhen } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  enableWhen(
    path.submitButton,
    () => form.controls.agreeToTerms.value === true
  ),
]
```

### Пример: Пошаговая форма

```typescript
const form = new GroupNode({
  schema: {
    step1Complete: new FieldNode({ value: false }),
    step2Data: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    enableWhen(path.step2Data, () =>
      form.controls.step1Complete.value === true
    ),
  ],
});
```

## resetWhen

Сбросить поле к начальному значению когда условие становится истинным.

```typescript
import { resetWhen } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  // Сбросить детали при изменении типа
  resetWhen(
    path.typeDetails,
    () => form.controls.type.value,
    { watchValue: true }
  ),
]
```

### Пример: Зависимые выпадающие списки

```typescript
const form = new GroupNode({
  schema: {
    country: new FieldNode({ value: '' }),
    city: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    // Сбросить город при изменении страны
    resetWhen(
      path.city,
      () => form.controls.country.value,
      { watchValue: true }
    ),
  ],
});

form.controls.country.setValue('RU');
form.controls.city.setValue('Москва');
form.controls.country.setValue('US'); // city сбрасывается в ''
```

## Комбинирование условий

Использование нескольких behaviors вместе:

```typescript
behaviorSchema: (path, ctx) => [
  // Показать бизнес-поля только для бизнес-аккаунтов
  showWhen(path.companyName, () =>
    form.controls.accountType.value === 'business'
  ),
  showWhen(path.taxId, () =>
    form.controls.accountType.value === 'business'
  ),

  // Сбросить бизнес-поля при переключении на личный аккаунт
  resetWhen(path.companyName, () =>
    form.controls.accountType.value === 'personal'
  ),
  resetWhen(path.taxId, () =>
    form.controls.accountType.value === 'personal'
  ),
]
```

## Сложные условия

```typescript
behaviorSchema: (path, ctx) => [
  showWhen(path.spouseInfo, () => {
    const status = form.controls.maritalStatus.value;
    const includeSpouse = form.controls.includeSpouse.value;
    return status === 'married' && includeSpouse === true;
  }),
]
```

## Следующие шаги

- [Синхронизация](/docs/behaviors/sync) — копирование и синхронизация полей
- [Watch Behaviors](/docs/behaviors/watch) — реакция на изменения
