import { required, min, email, phone } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CoBorrower } from './type';

export const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (
  path: FieldPath<CoBorrower>
) => {
  required(path.personalData.firstName, { message: 'Имя обязательно' });
  required(path.personalData.lastName, { message: 'Фамилия обязательна' });

  required(path.phone, { message: 'Номер телефона обязателен' });
  phone(path.phone, { message: 'Неверный формат телефона' });

  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 0, { message: 'Доход должен быть неотрицательным' });

  required(path.relationship, { message: 'Связь с заявителем обязательна' });
};
