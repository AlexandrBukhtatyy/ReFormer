import { validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

/**
 * Валидация между шагами
 *
 * Валидирует бизнес-правила, охватывающие несколько шагов формы:
 * - Первоначальный платёж >= 20% от стоимости имущества
 * - Ежемесячный платёж <= 50% от общего дохода домохозяйства
 * - Сумма кредита <= цена автомобиля
 * - Требования возраста (18-70)
 * - Асинхронно: ИНН, СНИЛС, уникальность email
 */
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (
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

  // ==========================================
  // 5-7. Асинхронная валидация (ИНН, СНИЛС, email)
  // ПРИМЕЧАНИЕ: Закомментировано для демонстрации, т.к. требуют API
  // ==========================================
  // validateAsync(path.inn, async (inn) => { ... }, { debounce: 500 });
  // validateAsync(path.snils, async (snils) => { ... }, { debounce: 500 });
  // validateAsync(path.email, async (email) => { ... }, { debounce: 800 });
};
