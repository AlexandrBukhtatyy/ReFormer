import type { FieldPath, Validator, ValidationSchemaFn } from '@reformer/core';
import {
  applyWhen,
  validate,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

// ============================================================================
// Cross-field правила
// ============================================================================

const currentExperienceVsTotal: Validator<CreditApplicationForm, unknown> = (
  _value,
  _control,
  root
) => {
  const form = root.getValue();
  if (
    form.workExperienceCurrent &&
    form.workExperienceTotal &&
    form.workExperienceCurrent > form.workExperienceTotal
  ) {
    return {
      code: 'currentExperienceExceedsTotal',
      message: 'Стаж на текущем месте не может превышать общий стаж',
    };
  }
  return null;
};

const paymentToIncomeUnderHalf: Validator<CreditApplicationForm, unknown> = (
  _value,
  _control,
  root
) => {
  const form = root.getValue();
  const ratio = form.paymentToIncomeRatio;
  if (ratio && ratio > 50) {
    return {
      code: 'paymentToIncomeExceeded',
      message: `Ежемесячный платеж не должен превышать 50% от дохода (текущий: ${ratio}%)`,
    };
  }
  return null;
};

const additionalIncomeSourceProvided: Validator<CreditApplicationForm, unknown> = (
  _value,
  _control,
  root
) => {
  const form = root.getValue();
  if (form.additionalIncome && form.additionalIncome > 0 && !form.additionalIncomeSource) {
    return {
      code: 'additionalIncomeSourceRequired',
      message: 'Укажите источник дополнительного дохода',
    };
  }
  return null;
};

// ============================================================================
// Под-схемы для applyWhen
// ============================================================================

const employedFieldsRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.companyName, required({ message: 'Укажите название компании' }));
  validate(path.companyName, minLength(3, { message: 'Минимум 3 символа' }));
  validate(path.companyName, maxLength(200, { message: 'Максимум 200 символов' }));

  validate(path.companyInn, required({ message: 'ИНН компании обязателен' }));
  validate(
    path.companyInn,
    pattern(/^\d{10}$/, { message: 'ИНН компании должен содержать 10 цифр' })
  );

  validate(path.companyPhone, required({ message: 'Телефон компании обязателен' }));
  validate(
    path.companyPhone,
    pattern(/^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
      message: 'Формат: +7 (___) ___-__-__',
    })
  );

  validate(path.companyAddress, required({ message: 'Адрес компании обязателен' }));
  validate(path.companyAddress, minLength(10, { message: 'Минимум 10 символов' }));
  validate(path.companyAddress, maxLength(300, { message: 'Максимум 300 символов' }));

  validate(path.position, required({ message: 'Укажите должность' }));
  validate(path.position, minLength(3, { message: 'Минимум 3 символа' }));
  validate(path.position, maxLength(100, { message: 'Максимум 100 символов' }));

  validate(path.workExperienceTotal, required({ message: 'Укажите общий стаж работы' }));
  validate(path.workExperienceTotal, min(0, { message: 'Стаж не может быть отрицательным' }));
  validate(path.workExperienceTotal, max(60, { message: 'Максимальный стаж: 60 лет' }));

  validate(path.workExperienceCurrent, required({ message: 'Укажите стаж на текущем месте' }));
  validate(path.workExperienceCurrent, min(0, { message: 'Стаж не может быть отрицательным' }));
  validate(path.workExperienceCurrent, max(60, { message: 'Максимальный стаж: 60 лет' }));

  validate(path.workExperienceCurrent, currentExperienceVsTotal);
};

const selfEmployedFieldsRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.businessType, required({ message: 'Укажите тип бизнеса' }));

  validate(path.businessInn, required({ message: 'ИНН ИП обязателен' }));
  validate(path.businessInn, pattern(/^\d{12}$/, { message: 'ИНН ИП должен содержать 12 цифр' }));

  validate(path.businessActivity, required({ message: 'Укажите вид деятельности' }));
  validate(path.businessActivity, minLength(10, { message: 'Минимум 10 символов' }));
  validate(path.businessActivity, maxLength(300, { message: 'Максимум 300 символов' }));
};

// ============================================================================
// Главная схема
// ============================================================================

/**
 * Схема валидации для Шага 4: Информация о занятости.
 */
export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  validate(path.employmentStatus, required({ message: 'Укажите статус занятости' }));

  applyWhen(path.employmentStatus, (status) => status === 'employed', employedFieldsRules);
  applyWhen(path.employmentStatus, (status) => status === 'selfEmployed', selfEmployedFieldsRules);

  // Доход (для всех статусов)
  validate(path.monthlyIncome, required({ message: 'Укажите ежемесячный доход' }));
  validate(path.monthlyIncome, min(10000, { message: 'Минимальный доход: 10 000 ₽' }));
  validate(path.monthlyIncome, max(10000000, { message: 'Максимальный доход: 10 000 000 ₽' }));

  validate(
    path.additionalIncome,
    min(0, { message: 'Дополнительный доход не может быть отрицательным' })
  );
  validate(path.additionalIncome, max(10000000, { message: 'Максимальный доход: 10 000 000 ₽' }));

  validate(path.monthlyIncome, paymentToIncomeUnderHalf);
  validate(path.additionalIncomeSource, additionalIncomeSourceProvided);

  validate(path.additionalIncomeSource, minLength(5, { message: 'Минимум 5 символов' }));
  validate(path.additionalIncomeSource, maxLength(200, { message: 'Максимум 200 символов' }));
};
