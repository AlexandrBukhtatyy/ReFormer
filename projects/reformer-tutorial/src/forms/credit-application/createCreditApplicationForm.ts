import { createForm } from 'reformer';
import { creditApplicationSchema } from './schemas/credit-application';
import { creditApplicationBehaviors } from './schemas/behaviors/credit-application.behaviors';
import { creditApplicationValidation } from './schemas/validators/credit-application';
import type { CreditApplicationForm } from './types/credit-application.types';

/**
 * Создание формы кредитной заявки
 *
 * Валидация регистрируется при создании формы для:
 * - Полной валидации при submit
 * - Field-level валидаторов из FieldConfig
 *
 * Для multi-step форм используем validateForm(form, stepSchema)
 * для пошаговой валидации - она применяет только валидаторы шага.
 */
export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>({
    form: creditApplicationSchema,
    behavior: creditApplicationBehaviors,
    validation: creditApplicationValidation,
  });
};
