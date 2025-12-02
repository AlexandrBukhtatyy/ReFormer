import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import { apply, applyWhen, validateTree, required, pattern, email } from 'reformer/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

// Импортируем модульную validation схему для Address
import { addressValidation } from '../../nested-forms/Address/address-validation';

/**
 * Схема валидации для Шага 3: Контактная информация
 */
export const contactInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Основной телефон
  required(path.phoneMain, { message: 'Телефон обязателен' });
  pattern(path.phoneMain, /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
    message: 'Формат: +7 (___) ___-__-__',
  });

  // Дополнительный телефон (опциональный)
  // Если указан, должен быть в правильном формате и отличаться от основного
  pattern(path.phoneAdditional, /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
    message: 'Формат: +7 (___) ___-__-__',
  });

  // Email
  required(path.email, { message: 'Email обязателен' });
  email(path.email);

  // Дополнительный email (опциональный)
  // Если указан, должен быть в правильном формате и отличаться от основного
  email(path.emailAdditional);

  // Кросс-полевая валидация: дополнительный телефон должен отличаться от основного
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (!form.phoneAdditional) return null;

      if (form.phoneMain === form.phoneAdditional) {
        return {
          code: 'phoneDuplicate',
          message: 'Дополнительный телефон должен отличаться от основного',
        };
      }
      return null;
    },
    { targetField: 'phoneAdditional' }
  );

  // Кросс-полевая валидация: дополнительный email должен отличаться от основного
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (!form.emailAdditional) return null;

      if (form.email.toLowerCase() === form.emailAdditional.toLowerCase()) {
        return {
          code: 'emailDuplicate',
          message: 'Дополнительный email должен отличаться от основного',
        };
      }
      return null;
    },
    { targetField: 'emailAdditional' }
  );

  //  Валидация адреса регистрации через композицию
  apply(path.registrationAddress, addressValidation);

  //  Условная валидация адреса проживания через композицию
  applyWhen(
    path.sameAsRegistration,
    (value) => value === false,
    (path) => {
      apply(path.residenceAddress, addressValidation);
    }
  );
};
