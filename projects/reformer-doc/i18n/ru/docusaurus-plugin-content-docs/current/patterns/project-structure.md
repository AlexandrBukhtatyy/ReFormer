---
sidebar_position: 1
---

# Структура проекта

Организуйте формы для масштабируемости и поддерживаемости.

## Рекомендуемая структура

```
src/
├── components/
│   └── ui/                           # Переиспользуемые UI-компоненты
│       ├── FormField.tsx             # Обёртка для полей
│       ├── FormArrayManager.tsx      # Менеджер динамических массивов
│       └── ...                       # Input, Select, Checkbox и т.д.
│
├── forms/
│   └── [form-name]/                  # Модуль формы
│       ├── [FormName]Form.tsx        # Главный компонент формы
│       ├── create[FormName]Form.ts   # Фабрика создания формы
│       │
│       ├── types/                    # TypeScript типы
│       │   └── [form-name].types.ts
│       │
│       ├── schemas/                  # Схемы формы
│       │   ├── [form-name].ts        # Главная схема (композиция)
│       │   └── [reusable].ts         # Переиспользуемые подсхемы
│       │
│       ├── validators/               # Правила валидации
│       │   ├── [form-name].ts        # Полная валидация формы
│       │   └── [step-name].ts        # Валидация по шагам
│       │
│       ├── behaviors/                # Поведения формы
│       │   ├── [form-name].behaviors.ts  # Главные поведения
│       │   └── [step-name].ts        # Поведения по шагам
│       │
│       ├── steps/                    # Компоненты шагов (wizard)
│       │   ├── Step1Form.tsx
│       │   └── Step2Form.tsx
│       │
│       └── sub-forms/                # Переиспользуемые подформы
│           ├── AddressForm.tsx
│           └── PersonForm.tsx
│
└── lib/                              # Общие утилиты
```

## Ключевые файлы

### Фабрика формы

Создаёт экземпляр формы со схемой, валидацией и поведениями:

```typescript title="forms/credit-application/createCreditApplicationForm.ts"
import { GroupNode } from 'reformer';
import { creditApplicationSchema } from './schemas/credit-application';
import { creditApplicationValidation } from './validators/credit-application';
import { creditApplicationBehaviors } from './behaviors/credit-application.behaviors';
import type { CreditApplication } from './types/credit-application.types';

export function createCreditApplicationForm() {
  return new GroupNode<CreditApplication>({
    form: creditApplicationSchema,
    validation: creditApplicationValidation,
    behavior: creditApplicationBehaviors,
  });
}
```

### Главная схема

Композиция переиспользуемых подсхем:

```typescript title="forms/credit-application/schemas/credit-application.ts"
import { addressSchema } from './address';
import { personalDataSchema } from './personal-data';

export const creditApplicationSchema = {
  loanAmount: { value: 0 },
  loanTerm: { value: 12 },

  // Переиспользуемые схемы
  personalData: personalDataSchema,
  registrationAddress: addressSchema,
  residenceAddress: addressSchema,

  // Массивы
  properties: [propertySchema],
};
```

### Валидаторы по шагам

Организация валидации по шагам формы:

```typescript title="forms/credit-application/validators/loan-info.ts"
import { FieldPath } from 'reformer';
import { required, min, max } from 'reformer/validators';
import type { CreditApplication } from '../types/credit-application.types';

export function loanInfoValidation(path: FieldPath<CreditApplication>) {
  required(path.loanAmount);
  min(path.loanAmount, 50000);
  max(path.loanAmount, 10000000);

  required(path.loanTerm);
  min(path.loanTerm, 6);
  max(path.loanTerm, 360);
}
```

### Поведения по шагам

Организация поведений по шагам формы:

```typescript title="forms/credit-application/behaviors/loan-info.ts"
import { FieldPath } from 'reformer';
import { computeFrom, enableWhen } from 'reformer/behaviors';
import type { CreditApplication } from '../types/credit-application.types';

export function loanInfoBehaviors(path: FieldPath<CreditApplication>) {
  // Вычисление ежемесячного платежа
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }) => {
      const monthlyRate = interestRate / 100 / 12;
      return (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -loanTerm));
    }
  );

  // Показать поля автомобиля только для автокредита
  enableWhen(path.carInfo, (form) => form.loanType === 'auto');
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

```typescript title="forms/contact/ContactForm.tsx"
import { GroupNode } from 'reformer';
import { required, email } from 'reformer/validators';

interface ContactForm {
  name: string;
  email: string;
  message: string;
}

const form = new GroupNode<ContactForm>({
  form: {
    name: { value: '' },
    email: { value: '' },
    message: { value: '' },
  },
  validation: (path) => {
    required(path.name);
    required(path.email);
    email(path.email);
    required(path.message);
  },
});

export function ContactForm() {
  // Реализация компонента
}
```

### Средняя форма (раздельные файлы)

Разделите схему, валидацию и поведения:

```
forms/
└── registration/
    ├── RegistrationForm.tsx
    ├── schema.ts
    ├── validation.ts
    └── behaviors.ts
```

### Сложная многошаговая форма (полная структура)

Используйте полную рекомендуемую структуру:

```
forms/
└── credit-application/
    ├── CreditApplicationForm.tsx
    ├── createCreditApplicationForm.ts
    ├── types/
    ├── schemas/
    ├── validators/
    ├── behaviors/
    ├── steps/
    └── sub-forms/
```

## Лучшие практики

| Практика | Почему |
|----------|--------|
| Группируйте по форме, не по типу | Легче находить связанные файлы |
| Используйте фабричные функции | Свежий экземпляр формы каждый раз |
| Разделяйте валидаторы по шагам | Валидация только текущего шага |
| Выносите переиспользуемые схемы | DRY, консистентная валидация |
| Отделяйте компоненты подформ | Переиспользование между шагами |

## Следующие шаги

- [Композиция схем](/docs/core-concepts/schemas/composition) — Переиспользуемые схемы и валидаторы
