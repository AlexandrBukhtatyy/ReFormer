import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import {
  applyWhen,
  validate,
  required,
  min,
  max,
  notEmpty,
  validateItems,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

import { propertyValidation } from '../../nested-forms/Property/property-validation';
import { existingLoanValidation } from '../../nested-forms/ExistingLoan/existing-loan-validation';
import { coBorrowerValidation } from '../../nested-forms/CoBorrower/co-borrower-validation';

// ============================================================================
// Под-схемы для applyWhen — массивы (notEmpty + validateItems)
// ============================================================================

const propertiesArrayRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.properties, notEmpty({ message: 'Добавьте хотя бы один объект имущества' }));
  validateItems(path.properties, propertyValidation);
};

const existingLoansArrayRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(
    path.existingLoans,
    notEmpty({ message: 'Добавьте информацию о существующих кредитах' })
  );
  validateItems(path.existingLoans, existingLoanValidation);
};

const coBorrowersArrayRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.coBorrowers, notEmpty({ message: 'Добавьте информацию о созаемщике' }));
  validateItems(path.coBorrowers, coBorrowerValidation);
};

// ============================================================================
// Главная схема
// ============================================================================

/**
 * Схема валидации для Шага 5: Дополнительная информация.
 */
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  validate(path.maritalStatus, required({ message: 'Укажите семейное положение' }));

  validate(path.dependents, required({ message: 'Укажите количество иждивенцев' }));
  validate(path.dependents, min(0, { message: 'Количество не может быть отрицательным' }));
  validate(path.dependents, max(10, { message: 'Максимальное количество иждивенцев: 10' }));

  validate(path.education, required({ message: 'Укажите уровень образования' }));

  applyWhen(path.hasProperty, (value) => value === true, propertiesArrayRules);
  applyWhen(path.hasExistingLoans, (value) => value === true, existingLoansArrayRules);
  applyWhen(path.hasCoBorrower, (value) => value === true, coBorrowersArrayRules);
};
