import { required, pattern } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { Address } from './type';

export const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  required(path.city, { message: 'Город обязателен' });
  required(path.street, { message: 'Улица обязательна' });
  required(path.house, { message: 'Номер дома обязателен' });

  pattern(path.postalCode, /^\d{6}$/, {
    message: 'Почтовый код должен быть 6 цифр',
  });
};
