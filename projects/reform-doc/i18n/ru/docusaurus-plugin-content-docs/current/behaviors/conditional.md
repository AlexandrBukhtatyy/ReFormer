---
sidebar_position: 3
---

# Условная логика

Показ, скрытие, включение или отключение полей на основе условий.

## enableWhen

Включать поле только когда условие истинно.

```typescript
import { enableWhen } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  enableWhen(path.submitButton, () => form.controls.agreeToTerms.value === true),
];
```

### Пример: Пошаговая форма

```typescript
const form = new GroupNode({
  form: {
    step1Complete: { value: false },
    step2Data: { value: '' },
  },
  behaviors: (path, ctx) => [
    enableWhen(path.step2Data, () => form.controls.step1Complete.value === true),
  ],
});
```

## resetWhen

Сбросить поле к начальному значению когда условие становится истинным.

```typescript
import { resetWhen } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  // Сбросить детали при изменении типа
  resetWhen(path.typeDetails, () => form.controls.type.value, { watchValue: true }),
];
```

### Пример: Зависимые выпадающие списки

```typescript
const form = new GroupNode({
  form: {
    country: { value: '' },
    city: { value: '' },
  },
  behaviors: (path, ctx) => [
    // Сбросить город при изменении страны
    resetWhen(path.city, () => form.controls.country.value, { watchValue: true }),
  ],
});

form.controls.country.setValue('RU');
form.controls.city.setValue('Москва');
form.controls.country.setValue('US'); // city сбрасывается в ''
```

## Комбинирование условий

Использование нескольких behaviors вместе:

```typescript
behaviors: (path, ctx) => [
  // Показать бизнес-поля только для бизнес-аккаунтов
  enableWhen(path.companyName, () => form.controls.accountType.value === 'business'),
  enableWhen(path.taxId, () => form.controls.accountType.value === 'business'),

  // Сбросить бизнес-поля при переключении на личный аккаунт
  resetWhen(path.companyName, () => form.controls.accountType.value === 'personal'),
  resetWhen(path.taxId, () => form.controls.accountType.value === 'personal'),
];
```

## Сложные условия

```typescript
behaviors: (path, ctx) => [
  enableWhen(path.spouseInfo, () => {
    const status = form.controls.maritalStatus.value;
    const includeSpouse = form.controls.includeSpouse.value;
    return status === 'married' && includeSpouse === true;
  }),
];
```

## Следующие шаги

- [Синхронизация](/docs/behaviors/sync) — копирование и синхронизация полей
- [Watch Behaviors](/docs/behaviors/watch) — реакция на изменения
