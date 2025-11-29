import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

// Импортируйте валидаторы шагов
import { step1LoanValidation } from './loan-info';
import { step2PersonalValidation } from './personal-info';
import { step3ContactValidation } from './contact-info';
import { step4EmploymentValidation } from './employment';
import { step5AdditionalValidation } from './additional-info';
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
  step1LoanValidation(path);

  // ==========================================
  // Шаг 2: Личная информация
  // ==========================================
  step2PersonalValidation(path);

  // ==========================================
  // Шаг 3: Контактная информация
  // ==========================================
  step3ContactValidation(path);

  // ==========================================
  // Шаг 4: Занятость
  // ==========================================
  step4EmploymentValidation(path);

  // ==========================================
  // Шаг 5: Дополнительная информация
  // ==========================================
  step5AdditionalValidation(path);

  // ==========================================
  // Валидация между шагами
  // ==========================================
  crossStepValidation(path);
};
