import type { ValidationIssue } from '@reformer/core';
import { applyEach, defineValidation, validate, type Rule } from '@reformer/core/validation';
import { max, required } from '@reformer/core/validators';
import type {
  CreditApplicationForm,
  EducationLevel,
  MaritalStatus,
} from '../types/credit-application';
import { coBorrowerRules } from './common/co-borrower';
import { existingLoanRules } from './common/existing-loan';
import { propertyRules } from './common/property';
import { NON_NEGATIVE_RULES } from './common/rules';

const MARITAL_STATUS_RULES: Rule<MaritalStatus>[] = [required({ code: 'maritalStatus.required' })];

const DEPENDENTS_RULES: Rule<number>[] = [
  required({ code: 'dependents.required' }),
  ...NON_NEGATIVE_RULES,
  max(10, { code: 'dependents.max' }),
];

const EDUCATION_RULES: Rule<EducationLevel>[] = [required({ code: 'education.required' })];

/** Флаг включён, а список пуст: замечание вешается на флаг, код — у каждого флага свой. */
const requireItems = (
  enabled: boolean,
  items: readonly unknown[],
  code: string
): ValidationIssue | null => (enabled && items.length === 0 ? { code } : null);

export const additionalRules = defineValidation<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.maritalStatus, MARITAL_STATUS_RULES);
  validate(model.$.dependents, DEPENDENTS_RULES);
  validate(model.$.education, EDUCATION_RULES);

  cross(model.$.hasProperty, (application) =>
    requireItems(application.hasProperty, application.properties, 'properties.arrayEmpty')
  );
  cross(model.$.hasExistingLoans, (application) =>
    requireItems(
      application.hasExistingLoans,
      application.existingLoans,
      'existingLoans.arrayEmpty'
    )
  );
  cross(model.$.hasCoBorrower, (application) =>
    requireItems(application.hasCoBorrower, application.coBorrowers, 'coBorrowers.arrayEmpty')
  );

  applyEach(model.$.properties, propertyRules);
  applyEach(model.$.existingLoans, existingLoanRules);
  applyEach(model.$.coBorrowers, coBorrowerRules);
});
