import type { FieldPath, Validator, ValidationSchemaFn } from '@reformer/core';
import { apply, applyWhen, validate, required, pattern, email } from '@reformer/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

import { addressValidation } from '../../nested-forms/Address/address-validation';

// ============================================================================
// Cross-field правила
// ============================================================================

const phoneAdditionalDiffersFromMain: Validator<CreditApplicationForm, unknown> = (
  _value,
  _control,
  root
) => {
  const form = root.getValue();
  if (!form.phoneAdditional) return null;
  if (form.phoneMain === form.phoneAdditional) {
    return {
      code: 'phoneDuplicate',
      message: 'Дополнительный телефон должен отличаться от основного',
    };
  }
  return null;
};

const emailAdditionalDiffersFromMain: Validator<CreditApplicationForm, unknown> = (
  _value,
  _control,
  root
) => {
  const form = root.getValue();
  if (!form.emailAdditional) return null;
  if (form.email.toLowerCase() === form.emailAdditional.toLowerCase()) {
    return {
      code: 'emailDuplicate',
      message: 'Дополнительный email должен отличаться от основного',
    };
  }
  return null;
};

// ============================================================================
// Под-схемы для applyWhen
// ============================================================================

const residenceAddressRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path.residenceAddress, addressValidation);
};

// ============================================================================
// Главная схема
// ============================================================================

/**
 * Схема валидации для Шага 3: Контактная информация.
 */
export const contactInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Основной телефон
  validate(path.phoneMain, required({ message: 'Телефон обязателен' }));
  validate(
    path.phoneMain,
    pattern(/^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
      message: 'Формат: +7 (___) ___-__-__',
    })
  );

  // Дополнительный телефон (опциональный)
  validate(
    path.phoneAdditional,
    pattern(/^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
      message: 'Формат: +7 (___) ___-__-__',
    })
  );

  // Email
  validate(path.email, required({ message: 'Email обязателен' }));
  validate(path.email, email({ message: 'Введите корректный email' }));

  // Дополнительный email (опциональный)
  validate(path.emailAdditional, email({ message: 'Введите корректный email' }));

  validate(path.phoneAdditional, phoneAdditionalDiffersFromMain);
  validate(path.emailAdditional, emailAdditionalDiffersFromMain);

  // Адрес регистрации через композицию
  apply(path.registrationAddress, addressValidation);

  // Адрес проживания (если не совпадает с регистрацией)
  applyWhen(path.sameAsRegistration, (value) => value === false, residenceAddressRules);
};
