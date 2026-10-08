import type { ValidationError } from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  validateWhen,
  type Rule,
} from '@reformer/core/validation';
import { max, maxLength, min, minLength, pattern, required } from '@reformer/core/validators';
import { isEmployed, isSelfEmployed } from '../model/predicates';
import type { CreditApplicationForm, EmploymentStatus } from '../types/credit-application';
import { MAX_10M_RUB_RULES, NON_NEGATIVE_RULES, PHONE_FORMAT_RULES } from './common/rules';

const EMPLOYMENT_STATUS_RULES: Rule<EmploymentStatus>[] = [
  required({ message: 'Укажите статус занятости' }),
];

const COMPANY_NAME_RULES: Rule<string>[] = [
  required({ message: 'Укажите название компании' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const COMPANY_INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН компании обязателен' }),
  pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }),
];

const COMPANY_PHONE_RULES: Rule<string>[] = [
  required({ message: 'Телефон компании обязателен' }),
  ...PHONE_FORMAT_RULES,
];

const COMPANY_ADDRESS_RULES: Rule<string>[] = [
  required({ message: 'Адрес компании обязателен' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(300, { message: 'Максимум 300 символов' }),
];

const POSITION_RULES: Rule<string>[] = [
  required({ message: 'Укажите должность' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

/** Границы стажа в годах — общий и на текущем месте. */
const EXPERIENCE_YEARS_RULES: Rule<number | null>[] = [
  ...NON_NEGATIVE_RULES,
  max(60, { message: 'Максимум 60 лет' }),
];

const WORK_EXPERIENCE_TOTAL_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите общий стаж' }),
  ...EXPERIENCE_YEARS_RULES,
];

const WORK_EXPERIENCE_CURRENT_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите стаж на текущем месте' }),
  ...EXPERIENCE_YEARS_RULES,
];

const BUSINESS_TYPE_RULES: Rule<string>[] = [required({ message: 'Укажите тип бизнеса' })];

const BUSINESS_INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН ИП обязателен' }),
  pattern(/^\d{12}$/, { message: 'ИНН ИП — 12 цифр' }),
];

const BUSINESS_ACTIVITY_RULES: Rule<string>[] = [
  required({ message: 'Укажите вид деятельности' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(300, { message: 'Максимум 300 символов' }),
];

const MONTHLY_INCOME_RULES: Rule<number | null>[] = [
  required({ message: 'Укажите ежемесячный доход' }),
  min(10000, { message: 'Минимум 10 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const ADDITIONAL_INCOME_RULES: Rule<number | null>[] = [
  ...NON_NEGATIVE_RULES,
  ...MAX_10M_RUB_RULES,
];

const currentExperienceWithinTotal = (
  application: CreditApplicationForm
): ValidationError | null => {
  const { workExperienceCurrent, workExperienceTotal } = application;
  return workExperienceCurrent && workExperienceTotal && workExperienceCurrent > workExperienceTotal
    ? {
        code: 'currentExperienceExceedsTotal',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      }
    : null;
};

const additionalIncomeSourceRequired = (
  application: CreditApplicationForm
): ValidationError | null =>
  application.additionalIncome &&
  application.additionalIncome > 0 &&
  !application.additionalIncomeSource
    ? { code: 'additionalIncomeSourceRequired', message: 'Укажите источник дополнительного дохода' }
    : null;

export const employmentRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.employmentStatus, EMPLOYMENT_STATUS_RULES);

  validateWhen(
    () => isEmployed(model.employmentStatus),
    () => {
      validate(model.$.companyName, COMPANY_NAME_RULES);
      validate(model.$.companyInn, COMPANY_INN_RULES);
      validate(model.$.companyPhone, COMPANY_PHONE_RULES);
      validate(model.$.companyAddress, COMPANY_ADDRESS_RULES);
      validate(model.$.position, POSITION_RULES);
      validate(model.$.workExperienceTotal, WORK_EXPERIENCE_TOTAL_RULES);
      validate(model.$.workExperienceCurrent, WORK_EXPERIENCE_CURRENT_RULES);
      cross(model.$.workExperienceCurrent, currentExperienceWithinTotal);
    }
  );

  validateWhen(
    () => isSelfEmployed(model.employmentStatus),
    () => {
      validate(model.$.businessType, BUSINESS_TYPE_RULES);
      validate(model.$.businessInn, BUSINESS_INN_RULES);
      validate(model.$.businessActivity, BUSINESS_ACTIVITY_RULES);
    }
  );

  validate(model.$.monthlyIncome, MONTHLY_INCOME_RULES);
  validate(model.$.additionalIncome, ADDITIONAL_INCOME_RULES);
  cross(model.$.additionalIncomeSource, additionalIncomeSourceRequired);
});
