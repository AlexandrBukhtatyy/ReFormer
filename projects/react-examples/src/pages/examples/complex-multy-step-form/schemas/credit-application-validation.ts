import type { FieldPath, ValidationSchemaFn } from 'reformer';
import type { CreditApplicationForm } from '../types/credit-application';
import { apply, validateTree } from 'reformer/validators';

// Импортируем все схемы шагов
import { basicInfoValidation } from '../components/steps/BasicInfo/basic-info-validation';
import { personalDataValidation } from '../components/nested-forms/PersonalData/personal-data-validation';
import { contactInfoValidation } from '../components/steps/ContactInfo/contact-info-validation';
import { employmentValidation } from '../components/steps/Employment/employment-validation';
import { additionalValidation } from '../components/steps/AdditionalInfo/additional-validation';
import { confirmationValidation } from '../components/steps/Confirmation/confirmation-validation';

// Импортируем validator функции для вычисляемых полей
import {
  validatePaymentToIncome,
  validateAge,
  warnHighDebtLoad,
  warnSeniorAge,
  warnLowWorkExperience,
} from '../utils';

/**
 * Главная схема валидации формы заявки на кредит
 *
 * ✅ Валидирует ВСЮ форму целиком (все шаги)
 * ✅ Централизованное управление валидацией
 * ✅ Модульные схемы шагов (каждый в отдельном файле)
 * ✅ Дополнительные кросс-полевые валидации для вычисляемых полей
 *
 * Использование:
 * 1. При создании формы: form.applyValidationSchema(creditApplicationValidation)
 * 2. При переходе между шагами: используй STEP_VALIDATIONS[step] для валидации конкретного шага
 * 3. При финальной отправке: form.validate() проверит все поля
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
  validateTree<CreditApplicationForm>(validatePaymentToIncome, { targetField: 'monthlyPayment' });

  // Возраст заемщика (18-70 лет)
  validateTree<CreditApplicationForm>(validateAge, { targetField: 'age' });

  // ===================================================================
  // 3. Предупреждения (warnings) - не блокируют отправку формы
  // ===================================================================

  // Предупреждение о высокой долговой нагрузке (> 40%)
  validateTree<CreditApplicationForm>(warnHighDebtLoad, { targetField: 'paymentToIncomeRatio' });

  // Предупреждение о возрасте > 60 лет
  validateTree<CreditApplicationForm>(warnSeniorAge, { targetField: 'age' });

  // Предупреждение о малом стаже на текущем месте работы (< 3 месяцев)
  validateTree<CreditApplicationForm>(warnLowWorkExperience, { targetField: 'workExperienceCurrent' });
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
