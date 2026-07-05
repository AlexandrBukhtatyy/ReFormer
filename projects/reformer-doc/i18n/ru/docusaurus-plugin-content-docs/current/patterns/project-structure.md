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
import type { FormModel } from '@reformer/core';
import { loanInfoNodes } from './steps/loan-info/schema';
import { personalInfoNodes } from './steps/personal-info/schema';
import type { CreditApplicationForm } from './type';

// Корневой билдер схемы — объединяет фрагменты шагов, все привязаны к одной модели
export const creditApplicationSchema = (model: FormModel<CreditApplicationForm>) => ({
  ...loanInfoNodes(model),
  ...personalInfoNodes(model),
  // Вычисляемое поле на корневом уровне, заполняется поведением
  monthlyPayment: { value: model.$.monthlyPayment, disabled: true },
});
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
import type { FormModel } from '@reformer/core';
import { Input, Select, Textarea } from '@/components/ui';
import type { CreditApplicationForm } from '../../type';

// Фрагмент шага — привязывает поля этого шага к общей модели формы
export const loanInfoNodes = (model: FormModel<CreditApplicationForm>) => ({
  loanType: {
    value: model.$.loanType,
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
    value: model.$.loanAmount,
    component: Input,
    componentProps: { label: 'Сумма кредита', type: 'number' },
  },
  // ... остальные поля
});
```

### Валидаторы шага

```typescript title="forms/credit-application/steps/loan-info/validators.ts"
import { required, min, max } from '@reformer/core/validators';
import type { FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

// Валидация шага как узлы схемы для validateFormModel — без path-колбэков
export const loanValidationNodes = (model: FormModel<CreditApplicationForm>) => [
  { value: model.$.loanType, validators: [required({ message: 'Выберите тип кредита' })] },
  {
    value: model.$.loanAmount,
    validators: [
      required({ message: 'Введите сумму кредита' }),
      min(50000, { message: 'Минимум 50 000' }),
      max(10000000, { message: 'Максимум 10 000 000' }),
    ],
  },
  // Условная валидация для ипотеки — нативный branch-узел { when, children }
  {
    when: (_scope: unknown, root: unknown) =>
      (root as CreditApplicationForm).loanType === 'mortgage',
    children: [
      {
        value: model.$.propertyValue,
        validators: [required({ message: 'Введите стоимость недвижимости' })],
      },
      {
        value: model.$.initialPayment,
        validators: [required({ message: 'Введите первоначальный взнос' })],
      },
    ],
  },
];
```

### Поведения шага

```typescript title="forms/credit-application/steps/loan-info/behaviors.ts"
import { compute, enableWhen } from '@reformer/core/behaviors';
import type { FormModel } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

// Фрагмент поведения шага — вызывается внутри корневого defineFormBehavior
export const loanBehaviors = (model: FormModel<CreditApplicationForm>) => {
  // Показать поля ипотеки только для типа mortgage
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // Вычисление процентной ставки в зависимости от типа кредита
  compute(model.$.interestRate, () => {
    const rates: Record<CreditApplicationForm['loanType'], number> = {
      consumer: 15,
      mortgage: 10,
      car: 12,
    };
    return rates[model.loanType] ?? 15;
  });
};
```

### Корневые валидаторы (кросс-шаговые)

```typescript title="forms/credit-application/validators.ts"
import { validateFormModel } from '@reformer/core';
import type { FormModel, ModelValidator } from '@reformer/core';
import type { CreditApplicationForm } from './type';

// Импорт узлов валидации шагов
import { loanValidationNodes } from './steps/loan-info/validators';
import { personalValidationNodes } from './steps/personal-info/validators';

// Кросс-шаговое правило: первоначальный взнос >= 20% от стоимости недвижимости.
// ModelValidator читает соседние поля через `root` (плоские значения, без `.value.value`).
const minInitialPayment: ModelValidator<number, unknown, CreditApplicationForm> = (
  value,
  _scope,
  root
) => {
  if (root.loanType !== 'mortgage') return null;
  if (!root.propertyValue || !value) return null;
  const minPayment = root.propertyValue * 0.2;
  return value < minPayment
    ? { code: 'minInitialPayment', message: `Минимум: ${minPayment}` }
    : null;
};

// Единая схема валидации формы — объединяет узлы шагов и кросс-шаговое правило
export const creditApplicationValidationSchema = (model: FormModel<CreditApplicationForm>) => ({
  children: [
    ...loanValidationNodes(model),
    ...personalValidationNodes(model),
    { value: model.$.initialPayment, validators: [minInitialPayment] },
  ],
});

// Единая точка входа — headless-валидация всей формы
export const validateCreditApplication = (model: FormModel<CreditApplicationForm>) =>
  validateFormModel(model, creditApplicationValidationSchema(model));
```

### Главный компонент формы

```typescript title="forms/credit-application/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior } from '@reformer/core/behaviors';
import { creditApplicationSchema } from './schema';
import { loanBehaviors } from './steps/loan-info/behaviors';
import { personalBehaviors } from './steps/personal-info/behaviors';
import type { CreditApplicationForm as CreditApplicationFormType } from './type';

// Все реактивные правила формы — объединяет фрагменты поведений шагов
const creditApplicationBehavior = defineFormBehavior<CreditApplicationFormType>(({ model }) => {
  loanBehaviors(model);
  personalBehaviors(model);
});

function CreditApplicationForm() {
  // Стабильные model + form на время жизни компонента
  const form = useMemo(() => {
    const model = createModel<CreditApplicationFormType>({
      loanType: 'consumer',
      loanAmount: 0,
      loanTerm: 12,
      monthlyPayment: 0,
      interestRate: 15,
      // ... остальные поля формы (propertyValue, initialPayment, персональные данные, ...)
    });
    return createForm<CreditApplicationFormType>({
      model,
      schema: creditApplicationSchema(model),
      behavior: creditApplicationBehavior,
    });
  }, []);

  return (
    // ... рендер шагов формы; валидация запускается через validateCreditApplication(model)
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

| Практика                        | Почему                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| Колокация                       | Связанные файлы вместе, удобная навигация                   |
| Группировка по фиче, не по типу | Все файлы шага в одном месте                                |
| Используйте useMemo для формы   | Стабильный экземпляр формы в компоненте                     |
| Разделяйте валидаторы по шагам  | Валидация только текущего шага                              |
| Корневые агрегаторы             | Единая точка входа для схемы/валидаторов/поведений          |
| Выносите подформы               | Переиспользование адреса, персональных данных между формами |

## Преимущества колокации

1. **Обнаруживаемость** — Все связанные файлы в одной папке
2. **Поддерживаемость** — Изменение одного шага не затрагивает другие
3. **Рефакторинг** — Перемещение/переименование целых папок шагов
4. **Code Splitting** — Импорт только нужных валидаторов шага
5. **Командная работа** — Разные разработчики работают над разными шагами

## Следующие шаги

- [Композиция схем](/docs/core-concepts/schemas/composition) — Переиспользуемые схемы и валидаторы
