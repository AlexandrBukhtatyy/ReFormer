/**
 * Validation Schema для Address (адрес).
 *
 * Модульная схема валидации, применяется к любому полю типа Address через композицию.
 */

import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import { validate, required, minLength, maxLength, pattern } from '@reformer/core/validators';
import type { Address } from './AddressForm';

/**
 * Использование:
 * ```typescript
 * apply([path.registrationAddress, path.residenceAddress], addressValidation);
 * ```
 */
export const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  validate(path.region, required({ message: 'Укажите регион' }));
  validate(path.region, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.region, maxLength(100, { message: 'Максимум 100 символов' }));

  validate(path.city, required({ message: 'Укажите город' }));
  validate(path.city, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.city, maxLength(100, { message: 'Максимум 100 символов' }));

  validate(path.street, required({ message: 'Укажите улицу' }));
  validate(path.street, minLength(3, { message: 'Минимум 3 символа' }));
  validate(path.street, maxLength(200, { message: 'Максимум 200 символов' }));

  validate(path.house, required({ message: 'Укажите номер дома' }));
  validate(path.house, maxLength(10, { message: 'Максимум 10 символов' }));

  // Квартира — опционально
  validate(path.apartment, maxLength(10, { message: 'Максимум 10 символов' }));

  validate(path.postalCode, required({ message: 'Укажите почтовый индекс' }));
  validate(path.postalCode, pattern(/^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' }));
};
