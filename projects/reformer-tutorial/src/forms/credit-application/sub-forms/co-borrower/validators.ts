import { validate, required, min, email, phone } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CoBorrower } from './type';

export const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (
  path: FieldPath<CoBorrower>
) => {
  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));

  validate(path.phone, required({ message: 'Номер телефона обязателен' }));
  validate(path.phone, phone({ message: 'Неверный формат телефона' }));

  validate(path.email, required({ message: 'Email обязателен' }));
  validate(path.email, email({ message: 'Неверный формат email' }));

  validate(path.monthlyIncome, required({ message: 'Ежемесячный доход обязателен' }));
  validate(path.monthlyIncome, min(0, { message: 'Доход должен быть неотрицательным' }));

  validate(path.relationship, required({ message: 'Связь с заявителем обязательна' }));
};
