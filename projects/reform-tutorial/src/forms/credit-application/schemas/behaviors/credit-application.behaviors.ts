import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

// Импорт behaviors для каждого шага
import { loanBehaviorSchema } from './loan-info';
import { personalBehaviorSchema } from './personal-info';
import { contactBehaviorSchema } from './contact-info';
import { employmentBehaviorSchema } from './employment';
import { additionalBehaviorSchema } from './additional-info';
import { crossStepBehaviorsSchema } from './cross-step.behaviors';

/**
 * Полная схема поведений для формы заявки на кредит
 *
 * Организована по шагам формы для удобства поддержки:
 * - Шаг 1: Информация о кредите
 * - Шаг 2: Персональная информация
 * - Шаг 3: Контактная информация
 * - Шаг 4: Занятость
 * - Шаг 5: Дополнительная информация
 * - Кросс-шаговые: Поведения, охватывающие несколько шагов
 */
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Шаг 1: Информация о кредите
  // ==========================================
  loanBehaviorSchema(path);

  // ==========================================
  // Шаг 2: Персональная информация
  // ==========================================
  personalBehaviorSchema(path);

  // ==========================================
  // Шаг 3: Контактная информация
  // ==========================================
  contactBehaviorSchema(path);

  // ==========================================
  // Шаг 4: Занятость
  // ==========================================
  employmentBehaviorSchema(path);

  // ==========================================
  // Шаг 5: Дополнительная информация
  // ==========================================
  additionalBehaviorSchema(path);

  // ==========================================
  // Кросс-шаговые поведения
  // ==========================================
  crossStepBehaviorsSchema(path);
};
