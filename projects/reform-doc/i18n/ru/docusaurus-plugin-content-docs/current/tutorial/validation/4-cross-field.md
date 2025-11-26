---
sidebar_position: 4
---

# Кросс-полевая валидация

Кросс-полевая валидация с `validateTree`.

## Обзор

Кросс-полевая валидация позволяет проверять отношения между несколькими полями:

- Подтверждение пароля
- Проверка диапазона дат (начало < конец)
- Соотношение дохода к платежу
- Сравнение зависимых полей
- Бизнес-логика, охватывающая несколько полей

ReFormer предоставляет `validateTree` для валидации по всему состоянию формы.

## validateTree

Функция `validateTree` проверяет отношения между несколькими полями, получая доступ ко всему состоянию формы.

```typescript
import { validateTree } from 'reformer/validators';

validateTree<FormType>(
  validatorFn,    // Функция, получающая контекст формы и возвращающая ошибку или null
  options         // { targetField: string } - поле для привязки ошибки
);
```

### Контекст функции валидатора

Функция валидатора получает объект контекста:

```typescript
validateTree<FormType>((ctx) => {
  const form = ctx.form.getValue(); // Получить текущие значения формы

  // Выполнить валидацию
  if (/* валидация не пройдена */) {
    return {
      code: 'error-code',
      message: 'Сообщение об ошибке'
    };
  }

  return null; // Валидация пройдена
});
```

## Базовые примеры

### Подтверждение email

```typescript title="src/validators/email-validators.ts"
import { validateTree, required, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  email: string;
  emailAdditional: string;
  sameEmail: boolean;
}

export const emailValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.email, { message: 'Основной email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.emailAdditional, { message: 'Дополнительный email обязателен' });
  email(path.emailAdditional, { message: 'Неверный формат email' });

  // Кросс-полевая валидация: email должны совпадать когда sameEmail равно true
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.sameEmail && form.email && form.emailAdditional) {
        if (form.email !== form.emailAdditional) {
          return {
            code: 'emails-mismatch',
            message: 'Email не совпадают',
          };
        }
      }

      return null;
    },
    { targetField: 'emailAdditional' }
  );
};
```

### Валидация возраста на момент окончания кредита

```typescript title="src/validators/age-validators.ts"
import { validateTree, required, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  loanTerm: number; // в месяцах
}

export const ageValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.birthDate, { message: 'Дата рождения обязательна' });
  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  min(path.loanTerm, 6, { message: 'Минимальный срок 6 месяцев' });
  max(path.loanTerm, 360, { message: 'Максимальный срок 360 месяцев' });

  // Кросс-полевая валидация: возраст заемщика на момент окончания кредита не должен превышать 70 лет
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.birthDate && form.loanTerm > 0) {
        const birthDate = new Date(form.birthDate);
        const today = new Date();
        const currentAge = (today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const ageAtLoanEnd = currentAge + (form.loanTerm / 12);

        if (ageAtLoanEnd > 70) {
          return {
            code: 'age-limit-exceeded',
            message: 'Возраст на момент окончания кредита не может превышать 70 лет',
          };
        }
      }

      return null;
    },
    { targetField: 'loanTerm' }
  );
};
```

### Соотношение дохода к платежу

```typescript title="src/validators/credit-validators.ts"
import { validateTree, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditForm {
  monthlyIncome: number;
  monthlyPayment: number;
}

export const creditValidation: ValidationSchemaFn<CreditForm> = (
  path: FieldPath<CreditForm>
) => {
  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 0, { message: 'Доход не может быть отрицательным' });
  required(path.monthlyPayment, { message: 'Ежемесячный платёж обязателен' });
  min(path.monthlyPayment, 0, { message: 'Платёж не может быть отрицательным' });

  // Кросс-полевая валидация: платёж не может превышать 50% дохода
  validateTree<CreditForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.monthlyIncome > 0 && form.monthlyPayment > 0) {
        const maxPayment = form.monthlyIncome * 0.5;

        if (form.monthlyPayment > maxPayment) {
          return {
            code: 'payment-too-high',
            message: `Платёж не может превышать 50% дохода (максимум: ${maxPayment.toLocaleString()})`,
          };
        }
      }

      return null;
    },
    { targetField: 'monthlyPayment' }
  );
};
```

## Продвинутые примеры

### Проверка стажа работы

Текущий стаж не может превышать общий стаж:

```typescript title="src/validators/employment-validators.ts"
import { validateTree, required, min, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface EmploymentForm {
  employmentStatus: 'employed' | 'self-employed' | 'unemployed';
  workExperienceTotal: number;  // Общий стаж в годах
  workExperienceCurrent: number; // Стаж на текущем месте
}

export const employmentValidation: ValidationSchemaFn<EmploymentForm> = (
  path: FieldPath<EmploymentForm>
) => {
  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      required(path.workExperienceTotal, { message: 'Общий стаж обязателен' });
      min(path.workExperienceTotal, 0, { message: 'Не может быть отрицательным' });
      required(path.workExperienceCurrent, { message: 'Текущий стаж обязателен' });
      min(path.workExperienceCurrent, 0, { message: 'Не может быть отрицательным' });

      // Кросс-полевая: текущий не может превышать общий
      validateTree<EmploymentForm>(
        (ctx) => {
          const form = ctx.form.getValue();

          if (form.workExperienceCurrent > form.workExperienceTotal) {
            return {
              code: 'experience-exceeds-total',
              message: 'Текущий стаж не может превышать общий',
            };
          }

          return null;
        },
        { targetField: 'workExperienceCurrent' }
      );
    }
  );
};
```

### Процент первоначального взноса

Первоначальный взнос должен быть не менее 20% от стоимости недвижимости:

```typescript title="src/validators/mortgage-validators.ts"
import { validateTree, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface MortgageForm {
  propertyValue: number;
  initialPayment: number;
  loanAmount: number;
}

export const mortgageValidation: ValidationSchemaFn<MortgageForm> = (
  path: FieldPath<MortgageForm>
) => {
  required(path.propertyValue, { message: 'Стоимость недвижимости обязательна' });
  min(path.propertyValue, 500000, { message: 'Минимальная стоимость 500 000' });
  required(path.initialPayment, { message: 'Первоначальный взнос обязателен' });
  min(path.initialPayment, 0, { message: 'Не может быть отрицательным' });

  // Первоначальный взнос должен быть не менее 20% от стоимости
  validateTree<MortgageForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.propertyValue > 0 && form.initialPayment >= 0) {
        const minInitialPayment = form.propertyValue * 0.2;

        if (form.initialPayment < minInitialPayment) {
          return {
            code: 'initial-payment-too-low',
            message: `Первоначальный взнос должен быть не менее 20% (${minInitialPayment.toLocaleString()})`,
          };
        }
      }

      return null;
    },
    { targetField: 'initialPayment' }
  );

  // Сумма кредита не может превышать стоимость минус первоначальный взнос
  validateTree<MortgageForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.propertyValue > 0 && form.initialPayment > 0 && form.loanAmount > 0) {
        const maxLoanAmount = form.propertyValue - form.initialPayment;

        if (form.loanAmount > maxLoanAmount) {
          return {
            code: 'loan-exceeds-value',
            message: `Сумма кредита не может превышать ${maxLoanAmount.toLocaleString()}`,
          };
        }
      }

      return null;
    },
    { targetField: 'loanAmount' }
  );
};
```

### Ограничение срока по возрасту

Срок кредита ограничен так, чтобы заёмщик погасил его до 70 лет:

```typescript title="src/validators/loan-term-validators.ts"
import { validateTree, required, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface LoanForm {
  borrowerAge: number;
  loanTermMonths: number;
}

export const loanTermValidation: ValidationSchemaFn<LoanForm> = (
  path: FieldPath<LoanForm>
) => {
  required(path.borrowerAge, { message: 'Возраст обязателен' });
  min(path.borrowerAge, 18, { message: 'Должно быть не менее 18' });
  max(path.borrowerAge, 65, { message: 'Максимальный возраст 65' });

  required(path.loanTermMonths, { message: 'Срок кредита обязателен' });
  min(path.loanTermMonths, 12, { message: 'Минимальный срок 12 месяцев' });
  max(path.loanTermMonths, 360, { message: 'Максимальный срок 360 месяцев' });

  // Кросс-полевая: срок ограничен возрастом (погашение до 70 лет)
  validateTree<LoanForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.borrowerAge >= 18 && form.loanTermMonths > 0) {
        const maxAgeAtEnd = 70;
        const yearsUntil70 = maxAgeAtEnd - form.borrowerAge;
        const maxTermMonths = yearsUntil70 * 12;

        if (form.loanTermMonths > maxTermMonths) {
          return {
            code: 'term-exceeds-age-limit',
            message: `Кредит должен быть погашен до ${maxAgeAtEnd} лет. Максимальный срок: ${maxTermMonths} месяцев`,
          };
        }
      }

      return null;
    },
    { targetField: 'loanTermMonths' }
  );
};
```

## Несколько кросс-полевых валидаций

Применение нескольких кросс-полевых валидаций к форме:

```typescript title="src/validators/comprehensive-validators.ts"
import { validateTree, required, min, max, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  email: string;
  emailAdditional: string;
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
  monthlyPayment: number;
  propertyValue: number;
  initialPayment: number;
}

export const comprehensiveValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Базовые валидации полей
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный email' });
  required(path.emailAdditional, { message: 'Дополнительный email обязателен' });
  email(path.emailAdditional, { message: 'Неверный email' });
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальный кредит 50 000' });
  max(path.loanAmount, 5000000, { message: 'Максимальный кредит 5 000 000' });
  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  required(path.monthlyIncome, { message: 'Доход обязателен' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });

  // Кросс-полевая 1: Подтверждение email
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.email && form.emailAdditional && form.email !== form.emailAdditional) {
        return { code: 'email-mismatch', message: 'Email адреса не совпадают' };
      }
      return null;
    },
    { targetField: 'emailAdditional' }
  );

  // Кросс-полевая 2: Соотношение платежа к доходу
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.monthlyIncome > 0 && form.monthlyPayment > 0) {
        const maxPayment = form.monthlyIncome * 0.5;
        if (form.monthlyPayment > maxPayment) {
          return { code: 'payment-ratio', message: `Платеж не может превышать 50% дохода` };
        }
      }
      return null;
    },
    { targetField: 'monthlyPayment' }
  );

  // Кросс-полевая 3: Процент первоначального взноса
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.propertyValue > 0 && form.initialPayment >= 0) {
        const minInitialPayment = form.propertyValue * 0.2;
        if (form.initialPayment < minInitialPayment) {
          return { code: 'initial-payment-low', message: 'Первоначальный взнос должен быть не менее 20%' };
        }
      }
      return null;
    },
    { targetField: 'initialPayment' }
  );

  // Кросс-полевая 4: Сумма кредита vs стоимость недвижимости
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.propertyValue > 0 && form.initialPayment > 0 && form.loanAmount > 0) {
        const maxLoan = form.propertyValue - form.initialPayment;
        if (form.loanAmount > maxLoan) {
          return { code: 'loan-exceeds-value', message: `Кредит не может превышать ${maxLoan.toLocaleString()}` };
        }
      }
      return null;
    },
    { targetField: 'loanAmount' }
  );
};
```

## Пример кредитной заявки

Полная кросс-полевая валидация из кредитной заявки:

```typescript title="src/validators/credit-application-validators.ts"
import {
  validateTree,
  apply,
  applyWhen,
  required,
  min
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  // Персональные данные
  birthDate: string;
  // Трудоустройство
  employmentStatus: 'employed' | 'self-employed' | 'unemployed' | 'retired';
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  // Кредит
  loanAmount: number;
  loanTermMonths: number;
  monthlyPayment: number;
  // Недвижимость (для ипотеки)
  propertyValue: number;
  initialPayment: number;
}

// Валидатор: соотношение платежа к доходу
const validatePaymentToIncome = (ctx: { form: { getValue: () => CreditApplicationForm } }) => {
  const form = ctx.form.getValue();

  if (form.monthlyIncome > 0 && form.monthlyPayment > 0) {
    // Платёж не должен превышать 40% дохода
    const maxPayment = form.monthlyIncome * 0.4;

    if (form.monthlyPayment > maxPayment) {
      return {
        code: 'payment-ratio-exceeded',
        message: `Ежемесячный платёж не может превышать 40% дохода (максимум: ${maxPayment.toLocaleString()})`,
      };
    }
  }

  return null;
};

// Валидатор: процент первоначального взноса
const validateInitialPayment = (ctx: { form: { getValue: () => CreditApplicationForm } }) => {
  const form = ctx.form.getValue();

  if (form.propertyValue > 0 && form.initialPayment >= 0) {
    const minInitialPayment = form.propertyValue * 0.2;

    if (form.initialPayment < minInitialPayment) {
      return {
        code: 'initial-payment-low',
        message: `Первоначальный взнос должен быть не менее 20% (${minInitialPayment.toLocaleString()})`,
      };
    }
  }

  return null;
};

// Валидатор: стаж работы
const validateWorkExperience = (ctx: { form: { getValue: () => CreditApplicationForm } }) => {
  const form = ctx.form.getValue();

  if (form.workExperienceCurrent > form.workExperienceTotal) {
    return {
      code: 'experience-invalid',
      message: 'Текущий стаж не может превышать общий',
    };
  }

  return null;
};

export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Базовые валидации
  required(path.monthlyIncome, { message: 'Доход обязателен' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });
  required(path.monthlyPayment, { message: 'Платёж обязателен' });
  min(path.monthlyPayment, 0, { message: 'Не может быть отрицательным' });

  // Кросс-полевая: соотношение платежа к доходу
  validateTree<CreditApplicationForm>(validatePaymentToIncome, {
    targetField: 'monthlyPayment',
  });

  // Кросс-полевая: первоначальный взнос (условно)
  applyWhen(
    path.propertyValue,
    (value) => value > 0,
    () => {
      validateTree<CreditApplicationForm>(validateInitialPayment, {
        targetField: 'initialPayment',
      });
    }
  );

  // Кросс-полевая: стаж работы (условно)
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    () => {
      validateTree<CreditApplicationForm>(validateWorkExperience, {
        targetField: 'workExperienceCurrent',
      });
    }
  );
};
```

## Лучшие практики

### 1. Выбирайте правильное целевое поле

```typescript
// ✅ Привязываем ошибку к зависимому полю
validateTree<Form>(
  (ctx) => {
    if (ctx.form.getValue().password !== ctx.form.getValue().confirmPassword) {
      return { code: 'mismatch', message: 'Пароли не совпадают' };
    }
    return null;
  },
  { targetField: 'confirmPassword' } // Ошибка показывается на поле подтверждения
);

// ❌ Неправильная цель - запутывает пользователей
validateTree<Form>(
  (ctx) => { /* ... */ },
  { targetField: 'password' } // Ошибка на неправильном поле
);
```

### 2. Выносите функции валидаторов

```typescript
// ✅ Переиспользуемая функция валидатора
const validatePaymentRatio = (ctx) => {
  const form = ctx.form.getValue();
  if (form.monthlyPayment > form.monthlyIncome * 0.5) {
    return { code: 'ratio-exceeded', message: 'Платёж слишком высокий' };
  }
  return null;
};

validateTree<Form>(validatePaymentRatio, { targetField: 'monthlyPayment' });

// ❌ Сложная логика inline
validateTree<Form>(
  (ctx) => {
    // 20 строк сложной логики inline...
  },
  { targetField: 'field' }
);
```

### 3. Обрабатывайте граничные случаи

```typescript
// ✅ Проверяем валидность значений перед сравнением
validateTree<Form>(
  (ctx) => {
    const form = ctx.form.getValue();

    // Валидируем только если оба значения присутствуют и валидны
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);

      // Проверяем корректность дат
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        if (end <= start) {
          return { code: 'invalid-range', message: 'Окончание должно быть после начала' };
        }
      }
    }

    return null;
  },
  { targetField: 'endDate' }
);

// ❌ Нет проверок на null - может вызвать ошибки
validateTree<Form>(
  (ctx) => {
    const form = ctx.form.getValue();
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      return { code: 'error', message: 'Некорректно' };
    }
    return null;
  },
  { targetField: 'endDate' }
);
```

### 4. Используйте описательные сообщения об ошибках

```typescript
// ✅ Полезное, конкретное сообщение с контекстом
validateTree<Form>(
  (ctx) => {
    const form = ctx.form.getValue();
    const maxPayment = form.monthlyIncome * 0.5;

    if (form.monthlyPayment > maxPayment) {
      return {
        code: 'payment-ratio-exceeded',
        message: `Платёж не может превышать 50% дохода (максимум: ${maxPayment.toLocaleString()})`,
      };
    }
    return null;
  },
  { targetField: 'monthlyPayment' }
);

// ❌ Размытое сообщение
validateTree<Form>(
  (ctx) => {
    if (/* условие */) {
      return { code: 'error', message: 'Некорректное значение' };
    }
    return null;
  },
  { targetField: 'field' }
);
```

### 5. Комбинируйте с поведением revalidateWhen

```typescript
// В схеме поведений
import { revalidateWhen } from 'reformer/behaviors';

export const formBehavior: BehaviorSchemaFn<Form> = (path) => {
  // Перевалидировать ежемесячный платёж при изменении дохода
  revalidateWhen(path.monthlyPayment, [path.monthlyIncome]);
};

// В схеме валидации
export const formValidation: ValidationSchemaFn<Form> = (path) => {
  validateTree<Form>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.monthlyPayment > form.monthlyIncome * 0.5) {
        return { code: 'ratio', message: 'Платёж слишком высокий' };
      }
      return null;
    },
    { targetField: 'monthlyPayment' }
  );
};
```

## Следующий шаг

Теперь, когда вы понимаете кросс-полевую валидацию, давайте узнаем об асинхронной валидации с `validateAsync`.
