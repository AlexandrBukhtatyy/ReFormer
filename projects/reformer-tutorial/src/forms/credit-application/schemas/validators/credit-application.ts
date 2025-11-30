import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

// Импортируйте валидаторы шагов
import { loanValidation } from './loan-info';
import { personalValidation } from './personal-info';
import { contactValidation } from './contact-info';
import { employmentValidation } from './employment';
import { additionalValidation } from './additional-info';
import { crossStepValidation } from './cross-step';

/**
 * Полная схема валидации для формы кредитного заявления
 *
 * Организована по шагам формы для поддерживаемости:
 * - Шаг 1: Информация о кредите
 * - Шаг 2: Личная информация
 * - Шаг 3: Контактная информация
 * - Шаг 4: Занятость
 * - Шаг 5: Дополнительная информация
 * - Между шагами: Валидация, охватывающая несколько шагов
 */
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Шаг 1: Информация о кредите
  // ==========================================
  loanValidation(path);

  // ==========================================
  // Шаг 2: Личная информация
  // ==========================================
  personalValidation(path);

  // ==========================================
  // Шаг 3: Контактная информация
  // ==========================================
  contactValidation(path);

  // ==========================================
  // Шаг 4: Занятость
  // ==========================================
  employmentValidation(path);

  // ==========================================
  // Шаг 5: Дополнительная информация
  // ==========================================
  additionalValidation(path);

  // ==========================================
  // Валидация между шагами
  // ==========================================
  crossStepValidation(path);
};
