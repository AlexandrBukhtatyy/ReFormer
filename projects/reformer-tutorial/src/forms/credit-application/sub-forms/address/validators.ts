import { validate, required, pattern } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { Address } from './type';

export const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  validate(path.city, required({ message: 'Город обязателен' }));
  validate(path.street, required({ message: 'Улица обязательна' }));
  validate(path.house, required({ message: 'Номер дома обязателен' }));

  validate(path.postalCode, pattern(/^\d{6}$/, { message: 'Почтовый код должен быть 6 цифр' }));
};
