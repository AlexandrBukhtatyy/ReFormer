import type { ValidationError } from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  validateWhen,
  type Rule,
} from '@reformer/core/validation';
import { max, maxLength, min, minLength, required } from '@reformer/core/validators';
import { isCarLoan, isMortgage } from '../model/predicates';
import type { CreditApplicationForm, LoanType } from '../types/credit-application';
import { MAX_10M_RUB_RULES, NON_NEGATIVE_RULES } from './common/rules';

const CURRENT_YEAR = new Date().getFullYear();

const LOAN_TYPE_RULES: Rule<LoanType>[] = [required({ message: 'Выберите тип кредита' })];

const LOAN_AMOUNT_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите сумму кредита' }),
  min(50000, { message: 'Минимум 50 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const LOAN_TERM_RULES: Rule<number>[] = [
  required({ message: 'Укажите срок кредита' }),
  min(6, { message: 'Минимум 6 месяцев' }),
  max(240, { message: 'Максимум 240 месяцев' }),
];

const LOAN_PURPOSE_RULES: Rule<string>[] = [
  required({ message: 'Укажите цель кредита' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(500, { message: 'Не более 500 символов' }),
];

const PROPERTY_VALUE_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите стоимость недвижимости' }),
  min(1000000, { message: 'Минимум 1 000 000 ₽' }),
];

const INITIAL_PAYMENT_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите первоначальный взнос' }),
  ...NON_NEGATIVE_RULES,
];

const CAR_BRAND_RULES: Rule<string>[] = [
  required({ message: 'Укажите марку автомобиля' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
];

const CAR_MODEL_RULES: Rule<string>[] = [
  required({ message: 'Укажите модель автомобиля' }),
  minLength(1, { message: 'Минимум 1 символ' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
];

const CAR_YEAR_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите год выпуска' }),
  min(2000, { message: 'Не ранее 2000' }),
  max(CURRENT_YEAR + 1, { message: `Не позднее ${CURRENT_YEAR + 1}` }),
];

const CAR_PRICE_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите стоимость автомобиля' }),
  min(300000, { message: 'Минимум 300 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const initialPaymentWithinPropertyValue = (
  application: CreditApplicationForm
): ValidationError | null => {
  const { initialPayment, propertyValue } = application;
  if (!initialPayment || !propertyValue) return null;
  if (initialPayment > propertyValue)
    return {
      code: 'initialPaymentTooHigh',
      message: 'Первоначальный взнос не может превышать стоимость недвижимости',
    };
  if (initialPayment < propertyValue * 0.2)
    return {
      code: 'initialPaymentTooLow',
      message: 'Первоначальный взнос не может быть меньше 20% от стоимости недвижимости',
    };
  return null;
};

const loanAmountWithinPropertyValue = (
  application: CreditApplicationForm
): ValidationError | null => {
  const { loanAmount, propertyValue, initialPayment } = application;
  if (!loanAmount || !propertyValue || !initialPayment) return null;
  const maximumLoan = propertyValue - initialPayment;
  return loanAmount > maximumLoan
    ? {
        code: 'loanAmountExceedsMax',
        message: `Сумма кредита не может превышать ${maximumLoan.toLocaleString('ru-RU')} ₽ (стоимость минус взнос)`,
      }
    : null;
};

export const loanRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
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
