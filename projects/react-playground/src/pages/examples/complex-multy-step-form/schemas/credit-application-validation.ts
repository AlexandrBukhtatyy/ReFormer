import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import type { CreditApplicationForm } from '../types/credit-application';
import { apply, validateGroup } from '@reformer/core/validators';

// Импортируем все схемы шагов
import { basicInfoValidation } from '../components/steps/BasicInfo/basic-info-validation';
import { personalDataValidation } from '../components/nested-forms/PersonalData/personal-data-validation';
import { contactInfoValidation } from '../components/steps/ContactInfo/contact-info-validation';
import { employmentValidation } from '../components/steps/Employment/employment-validation';
import { additionalValidation } from '../components/steps/AdditionalInfo/additional-validation';
import { confirmationValidation } from '../components/steps/Confirmation/confirmation-validation';

// Импортируем cross-field валидаторы
import {
  validatePaymentToIncome,
  validateAge,
  warnHighDebtLoad,
  warnSeniorAge,
  warnLowWorkExperience,
} from '../utils';

/**
 * Главная схема валидации формы заявки на кредит.
 *
 * Валидирует ВСЮ форму целиком (все шаги). Модульные схемы шагов
 * подключаются через `apply`. Дополнительные кросс-полевые валидации
 * для вычисляемых полей применяются через `validateGroup` со scope = root.
 */
const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ===================================================================
  // 1. Композиция validation схем через apply
  // ===================================================================
  apply(path, basicInfoValidation);
  apply(path, personalDataValidation);
  apply(path, contactInfoValidation);
  apply(path, employmentValidation);
  apply(path, additionalValidation);
  apply(path, confirmationValidation);

  // ===================================================================
  // 2. Кросс-полевая валидация для вычисляемых полей
  // ===================================================================

  // Платежеспособность (процент платежа от дохода <= 50%)
  validateGroup(path, validatePaymentToIncome, { targetField: path.monthlyPayment });

  // Возраст заемщика (18-70 лет)
  validateGroup(path, validateAge, { targetField: path.age });

  // ===================================================================
  // 3. Предупреждения (warnings) - не блокируют отправку формы
  // ===================================================================

  // Высокая долговая нагрузка (> 40%)
  validateGroup(path, warnHighDebtLoad, { targetField: path.paymentToIncomeRatio });

  // Возраст > 60 лет
  validateGroup(path, warnSeniorAge, { targetField: path.age });

  // Малый стаж на текущем месте работы (< 3 месяцев)
  validateGroup(path, warnLowWorkExperience, { targetField: path.workExperienceCurrent });
};

export default creditApplicationValidation;

// Мапа для удобного доступа (если понадобится валидировать конкретный шаг отдельно)
export const STEP_VALIDATIONS = {
  1: basicInfoValidation,
  2: personalDataValidation,
  3: contactInfoValidation,
  4: employmentValidation,
  5: additionalValidation,
  6: confirmationValidation,
};
