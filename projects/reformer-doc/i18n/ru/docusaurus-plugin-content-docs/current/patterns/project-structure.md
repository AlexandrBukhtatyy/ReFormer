---
sidebar_position: 1
---

# Структура проекта

Организуйте формы для масштабируемости и поддерживаемости, используя **колокацию** — размещение связанных файлов вместе.

## Рекомендуемая структура (Колокация)

```
src/
├── components/
│   └── ui/                              # Переиспользуемые UI-компоненты
│       ├── FormField.tsx                # Обёртка для полей
│       ├── FormArrayManager.tsx         # Менеджер динамических массивов
│       └── ...                          # Input, Select, Checkbox и т.д.
│
├── forms/
│   └── [form-name]/                     # Модуль формы
│       ├── type.ts                      # Главный тип формы (объединяет типы шагов)
│       ├── schema.ts                    # Главная схема (объединяет схемы шагов)
│       ├── validators.ts                # Валидаторы (шаги + кросс-шаговые)
│       ├── behaviors.ts                 # Поведения (шаги + кросс-шаговые)
│       ├── [FormName]Form.tsx           # Главный компонент формы
│       │
│       ├── steps/                       # Модули шагов (wizard)
│       │   ├── loan-info/
│       │   │   ├── type.ts              # Типы шага
│       │   │   ├── schema.ts            # Схема шага
│       │   │   ├── validators.ts        # Валидаторы шага
│       │   │   ├── behaviors.ts         # Поведения шага
│       │   │   └── BasicInfoForm.tsx    # Компонент шага
│       │   │
│       │   ├── personal-info/
│       │   │   ├── type.ts
│       │   │   ├── schema.ts
│       │   │   ├── validators.ts
│       │   │   ├── behaviors.ts
│       │   │   └── PersonalInfoForm.tsx
│       │   │
│       │   └── confirmation/
│       │       ├── type.ts
│       │       ├── schema.ts
│       │       ├── validators.ts
│       │       └── ConfirmationForm.tsx
│       │
│       ├── sub-forms/                   # Переиспользуемые модули подформ
│       │   ├── address/
│       │   │   ├── type.ts
│       │   │   ├── schema.ts
│       │   │   ├── validators.ts
│       │   │   └── AddressForm.tsx
│       │   │
│       │   └── personal-data/
│       │       ├── type.ts
│       │       ├── schema.ts
│       │       ├── validators.ts
│       │       └── PersonalDataForm.tsx
│       │
│       ├── services/                    # API-сервисы
│       │   └── api.ts
│       │
│       └── utils/                       # Утилиты формы
│           └── formTransformers.ts
│
└── lib/                                 # Общие утилиты
```

## Ключевые принципы

### 1. Колокация

Каждый шаг формы и подформа самодостаточны и содержат:
- `type.ts` — TypeScript интерфейс
- `schema.ts` — Схема формы с конфигурацией полей
- `validators.ts` — Правила валидации
- `behaviors.ts` — Вычисляемые поля, условная логика
- `*Form.tsx` — React компонент

### 2. Корневые агрегаторы

Файлы на корневом уровне объединяют все модули шагов:

```typescript title="forms/credit-application/type.ts"
// Реэкспорт типов из шагов и подформ
export type { LoanInfoStep } from './steps/loan-info/type';
export type { PersonalInfoStep } from './steps/personal-info/type';
export type { Address } from './sub-forms/address/type';

// Главный интерфейс формы
export interface CreditApplicationForm {
  // Шаг 1: Информация о кредите
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  // ... остальные поля всех шагов
}
```

```typescript title="forms/credit-application/schema.ts"
import { loanInfoSchema } from './steps/loan-info/schema';
import { personalInfoSchema } from './steps/personal-info/schema';

export const creditApplicationSchema = {
  ...loanInfoSchema,
  ...personalInfoSchema,
  // Вычисляемые поля на корневом уровне
  monthlyPayment: { value: 0, disabled: true },
};
```

## Ключевые файлы

### Тип шага

```typescript title="forms/credit-application/steps/loan-info/type.ts"
export type LoanType = 'consumer' | 'mortgage' | 'car';

export interface LoanInfoStep {
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  // Для ипотеки
  propertyValue: number;
  initialPayment: number;
  // Для автокредита
  carBrand: string;
  carModel: string;
}
```

### Схема шага

```typescript title="forms/credit-application/steps/loan-info/schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Select, Textarea } from '@/components/ui';
import type { LoanInfoStep } from './type';

export const loanInfoSchema: FormSchema<LoanInfoStep> = {
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
      ],
    },
  },
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита', type: 'number' },
  },
  // ... остальные поля
};
```

### Валидаторы шага

```typescript title="forms/credit-application/steps/loan-info/validators.ts"
import { required, min, max, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../type';

export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимум 50 000' });
  max(path.loanAmount, 10000000, { message: 'Максимум 10 000 000' });

  // Условная валидация для ипотеки
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      required(p.initialPayment, { message: 'Введите первоначальный взнос' });
    }
  );
};
```

### Поведения шага

```typescript title="forms/credit-application/steps/loan-info/behaviors.ts"
import { computeFrom, enableWhen, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../type';

export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Показать поля ипотеки только для типа mortgage
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage');
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage');

  // Вычисление процентной ставки в зависимости от типа кредита
  computeFrom([path.loanType], path.interestRate, (values) => {
    const rates = { consumer: 15, mortgage: 10, car: 12 };
    return rates[values.loanType] || 15;
  });
};
```

### Корневые валидаторы (кросс-шаговые)

```typescript title="forms/credit-application/validators.ts"
import { validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from './type';

// Импорт валидаторов шагов
import { loanValidation } from './steps/loan-info/validators';
import { personalValidation } from './steps/personal-info/validators';

// Кросс-шаговая валидация
const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Первоначальный взнос >= 20% от стоимости недвижимости
  validate(path.initialPayment, (value, ctx) => {
    if (ctx.form.loanType.value.value !== 'mortgage') return null;
    const propertyValue = ctx.form.propertyValue.value.value;
    if (!propertyValue || !value) return null;
    const minPayment = propertyValue * 0.2;
    if (value < minPayment) {
      return { code: 'minInitialPayment', message: `Минимум: ${minPayment}` };
    }
    return null;
  });
};

// Объединение всех валидаторов
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  loanValidation(path);
  personalValidation(path);
  crossStepValidation(path);
};
```

### Главный компонент формы

```typescript title="forms/credit-application/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createForm } from 'reformer';
import { creditApplicationSchema } from './schema';
import { creditApplicationBehaviors } from './behaviors';
import { creditApplicationValidation } from './validators';
import type { CreditApplicationForm as CreditApplicationFormType } from './type';

function CreditApplicationForm() {
  // Создаём экземпляр формы с useMemo для стабильной ссылки
  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  return (
    // ... рендер шагов формы
  );
}
```

## Масштабирование: простые и сложные формы

### Простая форма (один файл)

Для небольших форм храните всё в одном файле:

```
forms/
└── contact/
    └── ContactForm.tsx     # Схема, валидация, поведения, компонент
```

### Средняя форма (раздельные файлы)

Разделите на отдельные файлы:

```
forms/
└── registration/
    ├── type.ts
    ├── schema.ts
    ├── validators.ts
    ├── behaviors.ts
    └── RegistrationForm.tsx
```

### Сложная многошаговая форма (полная колокация)

Используйте полную рекомендуемую структуру:

```
forms/
└── credit-application/
    ├── type.ts
    ├── schema.ts
    ├── validators.ts
    ├── behaviors.ts
    ├── CreditApplicationForm.tsx
    ├── steps/
    │   ├── loan-info/
    │   ├── personal-info/
    │   ├── contact-info/
    │   ├── employment/
    │   ├── additional-info/
    │   └── confirmation/
    ├── sub-forms/
    │   ├── address/
    │   ├── personal-data/
    │   ├── passport-data/
    │   ├── property/
    │   ├── existing-loan/
    │   └── co-borrower/
    ├── services/
    │   └── api.ts
    └── utils/
        └── formTransformers.ts
```

## Лучшие практики

| Практика | Почему |
|----------|--------|
| Колокация | Связанные файлы вместе, удобная навигация |
| Группировка по фиче, не по типу | Все файлы шага в одном месте |
| Используйте useMemo для формы | Стабильный экземпляр формы в компоненте |
| Разделяйте валидаторы по шагам | Валидация только текущего шага |
| Корневые агрегаторы | Единая точка входа для схемы/валидаторов/поведений |
| Выносите подформы | Переиспользование адреса, персональных данных между формами |

## Преимущества колокации

1. **Обнаруживаемость** — Все связанные файлы в одной папке
2. **Поддерживаемость** — Изменение одного шага не затрагивает другие
3. **Рефакторинг** — Перемещение/переименование целых папок шагов
4. **Code Splitting** — Импорт только нужных валидаторов шага
5. **Командная работа** — Разные разработчики работают над разными шагами

## Следующие шаги

- [Композиция схем](/docs/core-concepts/schemas/composition) — Переиспользуемые схемы и валидаторы
