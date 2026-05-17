/**
 * Validation schema для ExistingLoan.
 *
 * Применяется к каждому элементу массива existingLoans через ArrayNode.applyValidationSchema().
 */

import type { Validator } from '@reformer/core';
import {
  createFieldPath,
  validate,
  required,
  minLength,
  maxLength,
  min,
  max,
} from '@reformer/core/validators';
import type { ExistingLoan } from './ExistingLoanForm';

const remainingNotExceedAmount: Validator<ExistingLoan, unknown> = (_value, _control, root) => {
  const loan = root.getValue();
  if (loan.remainingAmount > loan.amount) {
    return {
      code: 'remainingExceedsAmount',
      message: 'Остаток долга не может превышать сумму кредита',
    };
  }
  return null;
};

const maturityDateInFuture: Validator<ExistingLoan, unknown> = (_value, _control, root) => {
  const loan = root.getValue();
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
};

/**
 * Валидация элемента существующего кредита
 */
export const existingLoanValidation = (path: ReturnType<typeof createFieldPath<ExistingLoan>>) => {
  validate(path.bank, required({ message: 'Укажите название банка' }));
  validate(
    path.bank,
    minLength(3, { message: 'Название банка должно содержать минимум 3 символа' })
  );
  validate(
    path.bank,
    maxLength(100, { message: 'Название банка не может превышать 100 символов' })
  );

  validate(path.type, required({ message: 'Укажите тип кредита' }));

  validate(path.amount, required({ message: 'Укажите сумму кредита' }));
  validate(path.amount, min(1000, { message: 'Минимальная сумма кредита: 1 000 ₽' }));
  validate(path.amount, max(100000000, { message: 'Максимальная сумма кредита: 100 000 000 ₽' }));

  validate(path.remainingAmount, required({ message: 'Укажите остаток долга' }));
  validate(path.remainingAmount, min(0, { message: 'Остаток долга не может быть отрицательным' }));

  validate(path.monthlyPayment, required({ message: 'Укажите ежемесячный платеж' }));
  validate(path.monthlyPayment, min(100, { message: 'Минимальный ежемесячный платеж: 100 ₽' }));

  validate(path.maturityDate, required({ message: 'Укажите дату погашения кредита' }));

  validate(path.remainingAmount, remainingNotExceedAmount);
  validate(path.maturityDate, maturityDateInFuture);
};
