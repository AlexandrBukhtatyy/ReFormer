/**
 * Validation Schema для Address (адрес)
 *
 * Модульная схема валидации, которая может быть применена
 * к любому полю типа Address через композицию.
 */

import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import { required, minLength, maxLength, pattern } from 'reformer/validators';
import type { Address } from './AddressForm';

/**
 * Validation схема для Address
 *
 * Применяется к вложенным полям типа Address через композицию:
 * ```typescript
 * apply([path.registrationAddress, path.residenceAddress], addressValidation);
 * ```
 */
export const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  // Регион
  required(path.region, { message: 'Укажите регион' });
  minLength(path.region, 2, { message: 'Минимум 2 символа' });
  maxLength(path.region, 100, { message: 'Максимум 100 символов' });

  // Город
  required(path.city, { message: 'Укажите город' });
  minLength(path.city, 2, { message: 'Минимум 2 символа' });
  maxLength(path.city, 100, { message: 'Максимум 100 символов' });

  // Улица
  required(path.street, { message: 'Укажите улицу' });
  minLength(path.street, 3, { message: 'Минимум 3 символа' });
  maxLength(path.street, 200, { message: 'Максимум 200 символов' });

  // Дом
  required(path.house, { message: 'Укажите номер дома' });
  maxLength(path.house, 10, { message: 'Максимум 10 символов' });

  // Квартира (опционально)
  // Не используем required, так как поле опциональное
  maxLength(path.apartment, 10, { message: 'Максимум 10 символов' });

  // Почтовый индекс
  required(path.postalCode, { message: 'Укажите почтовый индекс' });
  pattern(path.postalCode, /^\d{6}$/, {
    message: 'Индекс должен содержать 6 цифр',
  });
};
