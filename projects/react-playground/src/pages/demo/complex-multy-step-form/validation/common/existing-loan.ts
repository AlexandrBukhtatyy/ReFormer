import type { ValidationError } from '@reformer/core';
import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { max, maxLength, min, minLength, required } from '@reformer/core/validators';
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';
import { NON_NEGATIVE_RULES } from './rules';

const BANK_RULES: Rule<string>[] = [
  required({ message: 'Укажите название банка' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const TYPE_RULES: Rule<string>[] = [required({ message: 'Укажите тип кредита' })];

const AMOUNT_RULES: Rule<number>[] = [
  required({ message: 'Укажите сумму кредита' }),
  min(1000, { message: 'Минимум 1 000 ₽' }),
  max(100000000, { message: 'Максимум 100 000 000 ₽' }),
];

const REMAINING_AMOUNT_RULES: Rule<number>[] = [
  required({ message: 'Укажите остаток долга' }),
  ...NON_NEGATIVE_RULES,
];

const MONTHLY_PAYMENT_RULES: Rule<number>[] = [
  required({ message: 'Укажите ежемесячный платеж' }),
  min(100, { message: 'Минимум 100 ₽' }),
];

const MATURITY_DATE_RULES: Rule<string>[] = [required({ message: 'Укажите дату погашения' })];

// Правила над несколькими полями строки: получают снимок строки
const remainingWithinAmount = (existingLoan: ExistingLoan): ValidationError | null =>
  existingLoan.remainingAmount > existingLoan.amount
    ? { code: 'remainingExceedsAmount', message: 'Остаток долга не может превышать сумму кредита' }
    : null;

const maturityInFuture = (existingLoan: ExistingLoan): ValidationError | null => {
  if (!existingLoan.maturityDate) return null;
  const maturityDate = new Date(existingLoan.maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return maturityDate < today
    ? { code: 'maturityDateInPast', message: 'Дата погашения должна быть в будущем' }
    : null;
};

export const existingLoanRules = defineValidationSchema<ExistingLoan>(({ model, cross }) => {
  validate(model.$.bank, BANK_RULES);
  validate(model.$.type, TYPE_RULES);
  validate(model.$.amount, AMOUNT_RULES);
  validate(model.$.remainingAmount, REMAINING_AMOUNT_RULES);
  cross(model.$.remainingAmount, remainingWithinAmount);
  validate(model.$.monthlyPayment, MONTHLY_PAYMENT_RULES);
  validate(model.$.maturityDate, MATURITY_DATE_RULES);
  cross(model.$.maturityDate, maturityInFuture);
});
