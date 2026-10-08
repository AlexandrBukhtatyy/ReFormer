import type { ValidationError } from '@reformer/core';
import { applyEach, defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
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

const MARITAL_STATUS_RULES: Rule<MaritalStatus>[] = [
  required({ message: 'Укажите семейное положение' }),
];

const DEPENDENTS_RULES: Rule<number>[] = [
  required({ message: 'Укажите количество иждивенцев' }),
  ...NON_NEGATIVE_RULES,
  max(10, { message: 'Максимум 10' }),
];

const EDUCATION_RULES: Rule<EducationLevel>[] = [
  required({ message: 'Укажите уровень образования' }),
];

/** Флаг включён, а список пуст: ошибка вешается на флаг. */
const requireItems = (
  enabled: boolean,
  items: readonly unknown[],
  message: string
): ValidationError | null =>
  enabled && items.length === 0 ? { code: 'arrayEmpty', message } : null;

export const additionalRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.maritalStatus, MARITAL_STATUS_RULES);
  validate(model.$.dependents, DEPENDENTS_RULES);
  validate(model.$.education, EDUCATION_RULES);

  cross(model.$.hasProperty, (application) =>
    requireItems(
      application.hasProperty,
      application.properties,
      'Добавьте хотя бы один объект имущества'
    )
  );
  cross(model.$.hasExistingLoans, (application) =>
    requireItems(
      application.hasExistingLoans,
      application.existingLoans,
      'Добавьте информацию о кредите'
    )
  );
  cross(model.$.hasCoBorrower, (application) =>
    requireItems(
      application.hasCoBorrower,
      application.coBorrowers,
      'Добавьте информацию о созаемщике'
    )
  );

  applyEach(model.$.properties, propertyRules);
  applyEach(model.$.existingLoans, existingLoanRules);
  applyEach(model.$.coBorrowers, coBorrowerRules);
});
