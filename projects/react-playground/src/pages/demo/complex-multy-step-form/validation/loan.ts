import type { ValidationIssue } from '@reformer/core';
import { defineValidation, validate, validateWhen, type Rule } from '@reformer/core/validation';
import { max, maxLength, min, minLength, required } from '@reformer/core/validators';
import { isCarLoan, isMortgage } from '../model/predicates';
import type { CreditApplicationForm, LoanType } from '../types/credit-application';
import { MAX_10M_RUB_RULES, NON_NEGATIVE_RULES } from './common/rules';

const CURRENT_YEAR = new Date().getFullYear();

const LOAN_TYPE_RULES: Rule<LoanType>[] = [required({ code: 'loanType.required' })];

const LOAN_AMOUNT_RULES: Rule<number | null>[] = [
  required({ code: 'loanAmount.required' }),
  min(50000, { code: 'loanAmount.min' }),
  ...MAX_10M_RUB_RULES,
];

const LOAN_TERM_RULES: Rule<number>[] = [
  required({ code: 'loanTerm.required' }),
  min(6, { code: 'loanTerm.min' }),
  max(240, { code: 'loanTerm.max' }),
];

const LOAN_PURPOSE_RULES: Rule<string>[] = [
  required({ code: 'loanPurpose.required' }),
  minLength(10, { code: 'loanPurpose.minLength' }),
  maxLength(500, { code: 'loanPurpose.maxLength' }),
];

const PROPERTY_VALUE_RULES: Rule<number | null>[] = [
  required({ code: 'propertyValue.required' }),
  min(1000000, { code: 'propertyValue.min' }),
];

const INITIAL_PAYMENT_RULES: Rule<number | null>[] = [
  required({ code: 'initialPayment.required' }),
  ...NON_NEGATIVE_RULES,
];

const CAR_BRAND_RULES: Rule<string>[] = [
  required({ code: 'carBrand.required' }),
  minLength(2, { code: 'carBrand.minLength' }),
  maxLength(50, { code: 'carBrand.maxLength' }),
];

const CAR_MODEL_RULES: Rule<string>[] = [
  required({ code: 'carModel.required' }),
  minLength(1, { code: 'carModel.minLength' }),
  maxLength(50, { code: 'carModel.maxLength' }),
];

const CAR_YEAR_RULES: Rule<number | null>[] = [
  required({ code: 'carYear.required' }),
  min(2000, { code: 'carYear.min' }),
  max(CURRENT_YEAR + 1, { code: 'carYear.max' }),
];

const CAR_PRICE_RULES: Rule<number | null>[] = [
  required({ code: 'carPrice.required' }),
  min(300000, { code: 'carPrice.min' }),
  ...MAX_10M_RUB_RULES,
];

const initialPaymentWithinPropertyValue = (
  application: CreditApplicationForm
): ValidationIssue | null => {
  const { initialPayment, propertyValue } = application;
  if (!initialPayment || !propertyValue) return null;
  if (initialPayment > propertyValue)
    return {
      code: 'initialPaymentTooHigh',
    };
  if (initialPayment < propertyValue * 0.2)
    return {
      code: 'initialPaymentTooLow',
    };
  return null;
};

const loanAmountWithinPropertyValue = (
  application: CreditApplicationForm
): ValidationIssue | null => {
  const { loanAmount, propertyValue, initialPayment } = application;
  if (!loanAmount || !propertyValue || !initialPayment) return null;
  const maximumLoan = propertyValue - initialPayment;
  return loanAmount > maximumLoan
    ? { code: 'loanAmountExceedsMax', params: { maximumLoan } }
    : null;
};

export const loanRules = defineValidation<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.loanType, LOAN_TYPE_RULES);
  validate(model.$.loanAmount, LOAN_AMOUNT_RULES);
  validate(model.$.loanTerm, LOAN_TERM_RULES);
  validate(model.$.loanPurpose, LOAN_PURPOSE_RULES);

  validateWhen(
    () => isMortgage(model.loanType),
    () => {
      cross(model.$.loanAmount, loanAmountWithinPropertyValue);
      validate(model.$.propertyValue, PROPERTY_VALUE_RULES);
      validate(model.$.initialPayment, INITIAL_PAYMENT_RULES);
      cross(model.$.initialPayment, initialPaymentWithinPropertyValue);
    }
  );

  validateWhen(
    () => isCarLoan(model.loanType),
    () => {
      validate(model.$.carBrand, CAR_BRAND_RULES);
      validate(model.$.carModel, CAR_MODEL_RULES);
      validate(model.$.carYear, CAR_YEAR_RULES);
      validate(model.$.carPrice, CAR_PRICE_RULES);
    }
  );
});
