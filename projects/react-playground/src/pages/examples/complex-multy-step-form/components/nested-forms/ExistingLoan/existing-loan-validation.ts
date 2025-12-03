/**
 * Validation schema для ExistingLoan
 *
 * Валидация элементов массива existingLoans.
 * Применяется к каждому элементу через ArrayNode.applyValidationSchema()
 */

import {
  createFieldPath,
  required,
  minLength,
  maxLength,
  min,
  max,
  validateTree,
} from '@reformer/core/validators';
import type { ExistingLoan } from './ExistingLoanForm';

/**
 * Валидация элемента существующего кредита
 */
export const existingLoanValidation = (path: ReturnType<typeof createFieldPath<ExistingLoan>>) => {
  // Название банка обязательно
  required(path.bank, { message: 'Укажите название банка' });
  minLength(path.bank, 3, {
    message: 'Название банка должно содержать минимум 3 символа',
  });
  maxLength(path.bank, 100, {
    message: 'Название банка не может превышать 100 символов',
  });

  // Тип кредита обязателен
  required(path.type, { message: 'Укажите тип кредита' });

  // Сумма кредита должна быть положительной
  required(path.amount, { message: 'Укажите сумму кредита' });
  min(path.amount, 1000, {
    message: 'Минимальная сумма кредита: 1 000 ₽',
  });
  max(path.amount, 100000000, {
    message: 'Максимальная сумма кредита: 100 000 000 ₽',
  });

  // Остаток долга не может быть отрицательным
  required(path.remainingAmount, { message: 'Укажите остаток долга' });
  min(path.remainingAmount, 0, {
    message: 'Остаток долга не может быть отрицательным',
  });

  // Ежемесячный платеж должен быть положительным
  required(path.monthlyPayment, { message: 'Укажите ежемесячный платеж' });
  min(path.monthlyPayment, 100, {
    message: 'Минимальный ежемесячный платеж: 100 ₽',
  });

  // Дата погашения обязательна
  required(path.maturityDate, { message: 'Укажите дату погашения кредита' });

  // Кросс-полевая валидация: остаток не может превышать сумму кредита
  validateTree<ExistingLoan>(
    (ctx) => {
      const loan = ctx.form.getValue();

      if (loan.remainingAmount > loan.amount) {
        return {
          code: 'remainingExceedsAmount',
          message: 'Остаток долга не может превышать сумму кредита',
        };
      }

      return null;
    },
    { targetField: 'remainingAmount' }
  );

  // Кросс-полевая валидация: дата погашения должна быть в будущем
  validateTree<ExistingLoan>(
    (ctx) => {
      const loan = ctx.form.getValue();

      if (!loan.maturityDate) return null;

      const maturityDate = new Date(loan.maturityDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (maturityDate < today) {
        return {
          code: 'maturityDateInPast',
          message: 'Дата погашения должна быть в будущем',
        };
      }

      return null;
    },
    { targetField: 'maturityDate' }
  );
};
