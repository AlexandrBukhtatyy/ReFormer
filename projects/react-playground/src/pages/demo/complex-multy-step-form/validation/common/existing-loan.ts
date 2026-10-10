import type { ValidationIssue } from '@reformer/core';
import { defineValidation, validate, type Rule } from '@reformer/core/validation';
import { max, maxLength, min, minLength, required } from '@reformer/core/validators';
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';
import { NON_NEGATIVE_RULES } from './rules';

const BANK_RULES: Rule<string>[] = [
  required({ code: 'existingLoan.bank.required' }),
  minLength(3, { code: 'existingLoan.bank.minLength' }),
  maxLength(100, { code: 'existingLoan.bank.maxLength' }),
];

const TYPE_RULES: Rule<string>[] = [required({ code: 'existingLoan.type.required' })];

const AMOUNT_RULES: Rule<number>[] = [
  required({ code: 'existingLoan.amount.required' }),
  min(1000, { code: 'existingLoan.amount.min' }),
  max(100000000, { code: 'existingLoan.amount.max' }),
];

const REMAINING_AMOUNT_RULES: Rule<number>[] = [
  required({ code: 'existingLoan.remainingAmount.required' }),
  ...NON_NEGATIVE_RULES,
];

const MONTHLY_PAYMENT_RULES: Rule<number>[] = [
  required({ code: 'existingLoan.monthlyPayment.required' }),
  min(100, { code: 'existingLoan.monthlyPayment.min' }),
];

const MATURITY_DATE_RULES: Rule<string>[] = [
  required({ code: 'existingLoan.maturityDate.required' }),
];

// Правила над несколькими полями строки: получают снимок строки
const remainingWithinAmount = (existingLoan: ExistingLoan): ValidationIssue | null =>
  existingLoan.remainingAmount > existingLoan.amount ? { code: 'remainingExceedsAmount' } : null;

const maturityInFuture = (existingLoan: ExistingLoan): ValidationIssue | null => {
  if (!existingLoan.maturityDate) return null;
  const maturityDate = new Date(existingLoan.maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return maturityDate < today ? { code: 'maturityDateInPast' } : null;
};

export const existingLoanRules = defineValidation<ExistingLoan>(({ model, cross }) => {
  validate(model.$.bank, BANK_RULES);
  validate(model.$.type, TYPE_RULES);
  validate(model.$.amount, AMOUNT_RULES);
  validate(model.$.remainingAmount, REMAINING_AMOUNT_RULES);
  cross(model.$.remainingAmount, remainingWithinAmount);
  validate(model.$.monthlyPayment, MONTHLY_PAYMENT_RULES);
  validate(model.$.maturityDate, MATURITY_DATE_RULES);
  cross(model.$.maturityDate, maturityInFuture);
});
