import { required, email, phone, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 3: Контактная информация
 */
export const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Номера телефонов
  required(path.phoneMain, { message: 'Главный номер телефона обязателен' });
  phone(path.phoneMain, { message: 'Неверный формат телефона' });
  phone(path.phoneAdditional, { message: 'Неверный формат телефона' });

  // Адреса email
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  email(path.emailAdditional, { message: 'Неверный формат email' });

  // Адрес регистрации
  required(path.registrationAddress.city, { message: 'Город обязателен' });
  required(path.registrationAddress.street, { message: 'Улица обязательна' });
  required(path.registrationAddress.house, { message: 'Номер дома обязателен' });
  pattern(path.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Почтовый код должен быть 6 цифр',
  });

  // Адрес проживания (условно обязателен)
  applyWhen(
    path.sameAsRegistration,
    (same) => !same,
    (p) => {
      required(p.residenceAddress.city, { message: 'Город обязателен' });
      required(p.residenceAddress.street, { message: 'Улица обязательна' });
      required(p.residenceAddress.house, { message: 'Номер дома обязателен' });
    }
  );

  pattern(path.residenceAddress.postalCode, /^\d{6}$/, {
    message: 'Почтовый код должен быть 6 цифр',
  });
};
