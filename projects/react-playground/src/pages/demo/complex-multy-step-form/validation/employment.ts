import type { ValidationIssue } from '@reformer/core';
import { defineValidation, validate, validateWhen, type Rule } from '@reformer/core/validation';
import { maxLength, min, minLength, pattern, required } from '@reformer/core/validators';
import { isEmployed, isSelfEmployed } from '../model/predicates';
import type { CreditApplicationForm, EmploymentStatus } from '../types/credit-application';
import { MAX_10M_RUB_RULES, NON_NEGATIVE_RULES, PHONE_FORMAT_RULES } from './common/rules';

const EMPLOYMENT_STATUS_RULES: Rule<EmploymentStatus>[] = [
  required({ code: 'employmentStatus.required' }),
];

const COMPANY_NAME_RULES: Rule<string>[] = [
  required({ code: 'companyName.required' }),
  minLength(3, { code: 'companyName.minLength' }),
  maxLength(200, { code: 'companyName.maxLength' }),
];

const COMPANY_INN_RULES: Rule<string>[] = [
  required({ code: 'companyInn.required' }),
  pattern(/^\d{10}$/, { code: 'companyInn.pattern' }),
];

const COMPANY_PHONE_RULES: Rule<string>[] = [
  required({ code: 'companyPhone.required' }),
  ...PHONE_FORMAT_RULES,
];

const COMPANY_ADDRESS_RULES: Rule<string>[] = [
  required({ code: 'companyAddress.required' }),
  minLength(10, { code: 'companyAddress.minLength' }),
  maxLength(300, { code: 'companyAddress.maxLength' }),
];

const POSITION_RULES: Rule<string>[] = [
  required({ code: 'position.required' }),
  minLength(3, { code: 'position.minLength' }),
  maxLength(100, { code: 'position.maxLength' }),
];

/** Стаж — в месяцах, по спеке только неотрицательный: верхней границы нет. */
const WORK_EXPERIENCE_TOTAL_RULES: Rule<number | null>[] = [
  required({ code: 'workExperienceTotal.required' }),
  ...NON_NEGATIVE_RULES,
];

const WORK_EXPERIENCE_CURRENT_RULES: Rule<number | null>[] = [
  required({ code: 'workExperienceCurrent.required' }),
  ...NON_NEGATIVE_RULES,
];

const BUSINESS_TYPE_RULES: Rule<string>[] = [required({ code: 'businessType.required' })];

const BUSINESS_INN_RULES: Rule<string>[] = [
  required({ code: 'businessInn.required' }),
  pattern(/^\d{12}$/, { code: 'businessInn.pattern' }),
];

const BUSINESS_ACTIVITY_RULES: Rule<string>[] = [
  required({ code: 'businessActivity.required' }),
  minLength(10, { code: 'businessActivity.minLength' }),
  maxLength(300, { code: 'businessActivity.maxLength' }),
];

const MONTHLY_INCOME_RULES: Rule<number | null>[] = [
  required({ code: 'monthlyIncome.required' }),
  min(10000, { code: 'monthlyIncome.min' }),
  ...MAX_10M_RUB_RULES,
];

const ADDITIONAL_INCOME_RULES: Rule<number | null>[] = [
  ...NON_NEGATIVE_RULES,
  ...MAX_10M_RUB_RULES,
];

const currentExperienceWithinTotal = (
  application: CreditApplicationForm
): ValidationIssue | null => {
  const { workExperienceCurrent, workExperienceTotal } = application;
  return workExperienceCurrent && workExperienceTotal && workExperienceCurrent > workExperienceTotal
    ? {
        code: 'currentExperienceExceedsTotal',
      }
    : null;
};

const additionalIncomeSourceRequired = (
  application: CreditApplicationForm
): ValidationIssue | null =>
  application.additionalIncome &&
  application.additionalIncome > 0 &&
  !application.additionalIncomeSource
    ? { code: 'additionalIncomeSourceRequired' }
    : null;

export const employmentRules = defineValidation<CreditApplicationForm>(({ model, cross }) => {
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
