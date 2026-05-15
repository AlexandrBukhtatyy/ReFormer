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

/**
 * Схема валидации для Шага 5: Дополнительная информация
 */
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  validate(path.maritalStatus, required({ message: 'Укажите семейное положение' }));

  validate(path.dependents, required({ message: 'Укажите количество иждивенцев' }));
  validate(path.dependents, min(0, { message: 'Количество не может быть отрицательным' }));
  validate(path.dependents, max(10, { message: 'Максимальное количество иждивенцев: 10' }));

  validate(path.education, required({ message: 'Укажите уровень образования' }));

  // Имущество: массив + элементы
  applyWhen(
    path.hasProperty,
    (value) => value === true,
    (path) => {
      validate(path.properties, notEmpty({ message: 'Добавьте хотя бы один объект имущества' }));
      validateItems(path.properties, propertyValidation);
    }
  );

  // Существующие кредиты: массив + элементы
  applyWhen(
    path.hasExistingLoans,
    (value) => value === true,
    (path) => {
      validate(
        path.existingLoans,
        notEmpty({ message: 'Добавьте информацию о существующих кредитах' })
      );
      validateItems(path.existingLoans, existingLoanValidation);
    }
  );

  // Созаемщики: массив + элементы
  applyWhen(
    path.hasCoBorrower,
    (value) => value === true,
    (path) => {
      validate(path.coBorrowers, notEmpty({ message: 'Добавьте информацию о созаемщике' }));
      validateItems(path.coBorrowers, coBorrowerValidation);
    }
  );
};
