import { validate, required, min, minLength } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { Property } from './type';

export const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  validate(path.type, required({ message: 'Тип имущества обязателен' }));

  validate(path.description, required({ message: 'Описание имущества обязательно' }));
  validate(path.description, minLength(10, { message: 'Минимум 10 символов для описания' }));

  validate(path.estimatedValue, required({ message: 'Приблизительная стоимость обязательна' }));
  validate(path.estimatedValue, min(0, { message: 'Стоимость должна быть неотрицательной' }));
};
