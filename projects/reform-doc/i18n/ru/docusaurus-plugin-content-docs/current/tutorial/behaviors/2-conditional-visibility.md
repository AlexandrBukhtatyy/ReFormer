---
sidebar_position: 2
---

# Условная видимость

Показ и скрытие полей формы на основе условий.

## Обзор

Условная видимость позволяет динамически показывать или скрывать поля формы в зависимости от значений других полей. Типичные случаи использования:

- Показать поле "Другое" при выборе опции "Другое"
- Отображать поля ипотеки только при выборе типа кредита "ипотека"
- Показать секцию созаёмщика, когда пользователь указывает наличие созаёмщика
- Скрыть опциональные поля до тех пор, пока они не понадобятся

## Подходы к условной видимости

ReFormer предоставляет два основных подхода для условной видимости:

1. **Условный рендеринг React** (Рекомендуется) - Используйте `useFormControl` для подписки на значения полей и условного рендеринга компонентов
2. **enableWhen с resetOnDisable** - Деактивируйте поля, когда они не должны быть доступны, опционально сбрасывая их значения

### Условный рендеринг React

Наиболее распространённый и гибкий подход — использовать условный рендеринг React:

```tsx title="src/components/LoanForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';

function LoanForm({ control }: LoanFormProps) {
  // Подписываемся на изменения loanType
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-4">
      <FormField control={control.loanType} />

      {/* Показываем поля ипотеки только при выборе ипотеки */}
      {loanType === 'mortgage' && (
        <div className="space-y-4">
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </div>
      )}

      {/* Показываем поля автокредита только при выборе автокредита */}
      {loanType === 'car' && (
        <div className="space-y-4">
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <FormField control={control.carYear} />
        </div>
      )}
    </div>
  );
}
```

### Секции, управляемые чекбоксом

Распространённый паттерн — переключение секций чекбоксом:

```tsx title="src/components/AdditionalInfoForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { FormArraySection } from '@/components/FormArraySection';
import { PropertyForm } from '../nested-forms/PropertyForm';

function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      {/* Секция имущества */}
      <div className="space-y-4">
        <FormField control={control.hasProperty} />

        {hasProperty && (
          <FormArraySection
            title="Имущество"
            control={control.properties}
            itemComponent={PropertyForm}
            itemLabel="Имущество"
            addButtonLabel="+ Добавить имущество"
            emptyMessage="Нажмите для добавления"
            hasItems={hasProperty}
          />
        )}
      </div>

      {/* Секция созаёмщика */}
      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />

        {hasCoBorrower && (
          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-4">Информация о созаёмщике</h3>
            <FormField control={control.coBorrowerName} />
            <FormField control={control.coBorrowerIncome} />
          </div>
        )}
      </div>
    </div>
  );
}
```

### Видимость, управляемая select

Показ различных полей в зависимости от значения select:

```tsx title="src/components/EmploymentForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';

type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired';

function EmploymentForm({ control }: EmploymentFormProps) {
  const { value: status } = useFormControl(control.employmentStatus);

  return (
    <div className="space-y-4">
      <FormField control={control.employmentStatus} />

      {/* Трудоустроен - показать информацию о компании */}
      {status === 'employed' && (
        <div className="space-y-4 p-4 bg-blue-50 rounded">
          <h3 className="font-medium">Информация о компании</h3>
          <FormField control={control.companyName} />
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
          <FormField control={control.employmentDate} />
        </div>
      )}

      {/* Самозанятый - показать информацию о бизнесе */}
      {status === 'selfEmployed' && (
        <div className="space-y-4 p-4 bg-green-50 rounded">
          <h3 className="font-medium">Информация о бизнесе</h3>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </div>
      )}

      {/* Пенсионер - показать информацию о пенсии */}
      {status === 'retired' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded">
          <h3 className="font-medium">Информация о пенсии</h3>
          <FormField control={control.pensionType} />
          <FormField control={control.pensionAmount} />
        </div>
      )}

      {/* Безработный - показать дополнительный доход */}
      {status === 'unemployed' && (
        <div className="space-y-4 p-4 bg-yellow-50 rounded">
          <h3 className="font-medium">Источники дополнительного дохода</h3>
          <FormField control={control.additionalIncomeSource} />
          <FormField control={control.additionalIncomeAmount} />
        </div>
      )}
    </div>
  );
}
```

## Комбинирование видимости с enableWhen

Когда поля скрыты, часто нужно сбросить их значения и отключить валидацию. Используйте `enableWhen` с опцией `resetOnDisable`:

```typescript title="src/behaviors/loan-behavior.ts"
import { enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  // Поля ипотеки
  propertyValue: number;
  initialPayment: number;
  // Поля автокредита
  carBrand: string;
  carModel: string;
  carYear: number;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path: FieldPath<LoanForm>) => {
  // Поля ипотеки - активны только для ипотеки
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // Поля автокредита - активны только для автокредита
  enableWhen(path.carBrand, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
  enableWhen(path.carModel, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
  enableWhen(path.carYear, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
};
```

Затем в компоненте комбинируйте оба подхода:

```tsx title="src/components/LoanForm.tsx"
function LoanForm({ control }: LoanFormProps) {
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-4">
      <FormField control={control.loanType} />

      {/* Условный рендеринг + поля деактивированы через enableWhen когда скрыты */}
      {loanType === 'mortgage' && (
        <div className="space-y-4">
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </div>
      )}

      {loanType === 'car' && (
        <div className="space-y-4">
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <FormField control={control.carYear} />
        </div>
      )}
    </div>
  );
}
```

## Очистка массивов при скрытии

При скрытии секций с массивами очищайте массив, чтобы избежать отправки устаревших данных:

```typescript title="src/behaviors/application-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface ApplicationForm {
  hasProperty: boolean;
  properties: Property[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

export const applicationBehavior: BehaviorSchemaFn<ApplicationForm> = (path) => {
  // Очистить массив имущества когда hasProperty становится false
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) {
        ctx.form.properties?.clear();
      }
    },
    { immediate: false }
  );

  // Очистить массив созаёмщиков когда hasCoBorrower становится false
  watchField(
    path.hasCoBorrower,
    (hasCoBorrower, ctx) => {
      if (!hasCoBorrower) {
        ctx.form.coBorrowers?.clear();
      }
    },
    { immediate: false }
  );
};
```

## Вложенная условная видимость

Обработка нескольких уровней условной видимости:

```tsx title="src/components/AddressSection.tsx"
import { useFormControl } from 'reformer';
import { AddressForm } from '../nested-forms/AddressForm';

function AddressSection({ control }: AddressSectionProps) {
  const { value: hasResidenceAddress } = useFormControl(control.hasResidenceAddress);
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  return (
    <div className="space-y-6">
      {/* Адрес регистрации - всегда виден */}
      <div className="space-y-4">
        <h3 className="font-semibold">Адрес регистрации</h3>
        <AddressForm control={control.registrationAddress} testIdPrefix="registration" />
      </div>

      {/* Опция добавить другой адрес проживания */}
      <FormField control={control.hasResidenceAddress} />

      {/* Секция адреса проживания - показана только если hasResidenceAddress */}
      {hasResidenceAddress && (
        <div className="space-y-4">
          <FormField control={control.sameAsRegistration} />

          {/* Показать форму адреса только если НЕ совпадает с регистрацией */}
          {!sameAsRegistration && (
            <div className="space-y-4">
              <h3 className="font-semibold">Адрес проживания</h3>
              <AddressForm control={control.residenceAddress} testIdPrefix="residence" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Лучшие практики

### 1. Всегда используйте resetOnDisable для скрытых полей

Когда поле скрыто, его значение обычно должно быть сброшено:

```typescript
enableWhen(path.optionalField, (form) => form.showOptional, {
  resetOnDisable: true,  // Сброс значения при скрытии
});
```

### 2. Очищайте массивы при скрытии секций

```typescript
watchField(path.hasItems, (hasItems, ctx) => {
  if (!hasItems) {
    ctx.form.items?.clear();
  }
}, { immediate: false });
```

### 3. Комбинируйте behaviors с условным рендерингом

Используйте оба подхода вместе для надёжной обработки:

- **enableWhen** - Управляет состоянием поля (disabled, сброс значений)
- **Условный рендеринг** - Контролирует, что видит пользователь

### 4. Подписывайтесь только на нужное

Используйте точечные подписки, чтобы избежать лишних ре-рендеров:

```tsx
// ✅ Хорошо - подписка только на нужное поле
const { value: loanType } = useFormControl(control.loanType);

// ❌ Избегайте - подписка на всю форму когда не нужно
const formValues = useFormControl(control);
```

### 5. Используйте консистентные паттерны

Установите единообразный паттерн в проекте:

```tsx
// Паттерн: чекбокс + условная секция
<FormField control={control.hasFeature} />
{hasFeature && <FeatureSection control={control.feature} />}
```

## Следующий шаг

Теперь, когда вы понимаете условную видимость, давайте узнаем о включении и отключении полей с помощью `enableWhen` и `disableWhen`.
