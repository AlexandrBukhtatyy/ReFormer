import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import {
  apply,
  applyWhen,
  validate,
  validateGroup,
  required,
  pattern,
  email,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

import { addressValidation } from '../../nested-forms/Address/address-validation';

/**
 * Схема валидации для Шага 3: Контактная информация
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
  validate(path.email, email());

  // Дополнительный email (опциональный)
  validate(path.emailAdditional, email());

  // Cross-field: дополнительный телефон отличается от основного
  validateGroup(
    path,
    (scope) => {
      const form = scope.getValue();
      if (!form.phoneAdditional) return null;
      if (form.phoneMain === form.phoneAdditional) {
        return {
          code: 'phoneDuplicate',
          message: 'Дополнительный телефон должен отличаться от основного',
        };
      }
      return null;
    },
    { targetField: path.phoneAdditional }
  );

  // Cross-field: дополнительный email отличается от основного
  validateGroup(
    path,
    (scope) => {
      const form = scope.getValue();
      if (!form.emailAdditional) return null;
      if (form.email.toLowerCase() === form.emailAdditional.toLowerCase()) {
        return {
          code: 'emailDuplicate',
          message: 'Дополнительный email должен отличаться от основного',
        };
      }
      return null;
    },
    { targetField: path.emailAdditional }
  );

  // Адрес регистрации через композицию
  apply(path.registrationAddress, addressValidation);

  // Условная валидация адреса проживания через композицию
  applyWhen(
    path.sameAsRegistration,
    (value) => value === false,
    (path) => {
      apply(path.residenceAddress, addressValidation);
    }
  );
};
