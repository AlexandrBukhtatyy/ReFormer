import type { FieldPath } from '@/lib/forms/core/types';
import {
  applyWhen,
  required,
  min,
  max,
  notEmpty,
  validateItems,
} from '@/lib/forms/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

// Импортируем validation схемы для элементов массивов
import { propertyValidation } from '../../nested-forms/Property/property-validation';
import { existingLoanValidation } from '../../nested-forms/ExistingLoan/existing-loan-validation';
import { coBorrowerValidation } from '../../nested-forms/CoBorrower/co-borrower-validation';

/**
 * Схема валидации для Шага 5: Дополнительная информация
 */
export const additionalValidation = (path: FieldPath<CreditApplicationForm>) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });

  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0, { message: 'Количество не может быть отрицательным' });
  max(path.dependents, 10, { message: 'Максимальное количество иждивенцев: 10' });

  required(path.education, { message: 'Укажите уровень образования' });

  // ✅ Валидация имущества: массив + элементы
  applyWhen(
    path.hasProperty,
    (value) => value === true,
    (path) => {
      // Массив не должен быть пустым
      notEmpty(path.properties, { message: 'Добавьте хотя бы один объект имущества' });

      // Валидация каждого элемента массива
      validateItems(path.properties, propertyValidation);
    }
  );

  // ✅ Валидация существующих кредитов: массив + элементы
  applyWhen(
    path.hasExistingLoans,
    (value) => value === true,
    (path) => {
      // Массив не должен быть пустым
      notEmpty(path.existingLoans, { message: 'Добавьте информацию о существующих кредитах' });

      // Валидация каждого элемента массива
      validateItems(path.existingLoans, existingLoanValidation);
    }
  );

  // ✅ Валидация созаемщиков: массив + элементы
  applyWhen(
    path.hasCoBorrower,
    (value) => value === true,
    (path) => {
      // Массив не должен быть пустым
      notEmpty(path.coBorrowers, { message: 'Добавьте информацию о созаемщике' });

      // Валидация каждого элемента массива
      validateItems(path.coBorrowers, coBorrowerValidation);
    }
  );
};
