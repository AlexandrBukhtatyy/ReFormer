import { validate, required, email, phone, pattern, applyWhen } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 3: Контактная информация
 */
export const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Номера телефонов
  validate(path.phoneMain, required({ message: 'Главный номер телефона обязателен' }));
  validate(path.phoneMain, phone({ message: 'Неверный формат телефона' }));
  validate(path.phoneAdditional, phone({ message: 'Неверный формат телефона' }));

  // Адреса email
  validate(path.email, required({ message: 'Email обязателен' }));
  validate(path.email, email({ message: 'Неверный формат email' }));
  validate(path.emailAdditional, email({ message: 'Неверный формат email' }));

  // Адрес регистрации
  validate(path.registrationAddress.city, required({ message: 'Город обязателен' }));
  validate(path.registrationAddress.street, required({ message: 'Улица обязательна' }));
  validate(path.registrationAddress.house, required({ message: 'Номер дома обязателен' }));
  validate(
    path.registrationAddress.postalCode,
    pattern(/^\d{6}$/, { message: 'Почтовый код должен быть 6 цифр' })
  );

  // Адрес проживания (условно обязателен)
  applyWhen(
    path.sameAsRegistration,
    (same) => !same,
    (p) => {
      validate(p.residenceAddress.city, required({ message: 'Город обязателен' }));
      validate(p.residenceAddress.street, required({ message: 'Улица обязательна' }));
      validate(p.residenceAddress.house, required({ message: 'Номер дома обязателен' }));
    }
  );

  validate(
    path.residenceAddress.postalCode,
    pattern(/^\d{6}$/, { message: 'Почтовый код должен быть 6 цифр' })
  );
};
