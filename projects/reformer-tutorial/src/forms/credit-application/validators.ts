import { validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from './type';

// Импорт валидаторов шагов
import { loanValidation } from './steps/loan-info/validators';
import { personalValidation } from './steps/personal-info/validators';
import { contactValidation } from './steps/contact-info/validators';
import { employmentValidation } from './steps/employment/validators';
import { additionalValidation } from './steps/additional-info/validators';
import { confirmationValidation } from './steps/confirmation/validators';

/**
 * Кросс-шаговая валидация
 *
 * Валидирует бизнес-правила, охватывающие несколько шагов формы:
 * - Первоначальный платёж >= 20% от стоимости имущества
 * - Ежемесячный платёж <= 50% от общего дохода домохозяйства
 * - Сумма кредита <= цена автомобиля
 * - Требования возраста (18-70)
 */
const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Первоначальный платёж >= 20% от имущества
  // ==========================================
  validate(path.initialPayment, (initialPayment, ctx) => {
    const loanType = ctx.form.loanType.value.value;
    if (loanType !== 'mortgage') return null;

    const propertyValue = ctx.form.propertyValue.value.value;
    if (!propertyValue || !initialPayment) return null;

    const minPayment = propertyValue * 0.2;
    if (initialPayment < minPayment) {
      return {
        code: 'minInitialPayment',
        message: `Минимальный первоначальный платёж: ${minPayment.toLocaleString()} (20% от стоимости имущества)`,
      };
    }

    return null;
  });

  // ==========================================
  // 2. Ежемесячный платёж <= 50% дохода
  // ==========================================
  validate(path.monthlyPayment, (monthlyPayment, ctx) => {
    const totalIncome = ctx.form.totalIncome.value.value || 0;
    const coBorrowersIncome = ctx.form.coBorrowersIncome.value.value || 0;
    const householdIncome = totalIncome + coBorrowersIncome;

    if (!householdIncome || !monthlyPayment) return null;

    const maxPayment = householdIncome * 0.5;
    if (monthlyPayment > maxPayment) {
      return {
        code: 'maxPaymentToIncome',
        message: `Ежемесячный платёж превышает 50% дохода домохозяйства (макс: ${maxPayment.toLocaleString()})`,
      };
    }

    return null;
  });

  // ==========================================
  // 3. Сумма кредита <= цена автомобиля
  // ==========================================
  validate(path.loanAmount, (loanAmount, ctx) => {
    const loanType = ctx.form.loanType.value.value;
    if (loanType !== 'car') return null;

    const carPrice = ctx.form.carPrice.value.value;
    if (!carPrice || !loanAmount) return null;

    if (loanAmount > carPrice) {
      return {
        code: 'loanExceedsCarPrice',
        message: 'Сумма кредита не может превышать цену автомобиля',
      };
    }

    return null;
  });

  // ==========================================
  // 4. Требования возраста (18-70)
  // ==========================================
  validate(path.age, (age) => {
    if (age === null || age === undefined) return null;

    if (age < 18) {
      return {
        code: 'minAge',
        message: 'Заявитель должен быть не моложе 18 лет',
      };
    }

    if (age > 70) {
      return {
        code: 'maxAge',
        message: 'Заявитель должен быть не старше 70 лет',
      };
    }

    return null;
  });
};

/**
 * Полная схема валидации для формы кредитного заявления
 *
 * Организована по шагам формы для поддерживаемости:
 * - Шаг 1: Информация о кредите
 * - Шаг 2: Личная информация
 * - Шаг 3: Контактная информация
 * - Шаг 4: Занятость
 * - Шаг 5: Дополнительная информация
 * - Шаг 6: Подтверждение
 * - Кросс-шаговые: Валидация между шагами
 */
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Шаг 1: Информация о кредите
  // ==========================================
  loanValidation(path);

  // ==========================================
  // Шаг 2: Личная информация
  // ==========================================
  personalValidation(path);

  // ==========================================
  // Шаг 3: Контактная информация
  // ==========================================
  contactValidation(path);

  // ==========================================
  // Шаг 4: Занятость
  // ==========================================
  employmentValidation(path);

  // ==========================================
  // Шаг 5: Дополнительная информация
  // ==========================================
  additionalValidation(path);

  // ==========================================
  // Шаг 6: Подтверждение
  // ==========================================
  confirmationValidation(path);

  // ==========================================
  // Валидация между шагами
  // ==========================================
  crossStepValidation(path);
};
