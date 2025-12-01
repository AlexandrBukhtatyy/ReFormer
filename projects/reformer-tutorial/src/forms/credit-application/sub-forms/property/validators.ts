import { required, min, minLength } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { Property } from './type';

export const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.type, { message: 'Тип имущества обязателен' });

  required(path.description, { message: 'Описание имущества обязательно' });
  minLength(path.description, 10, { message: 'Минимум 10 символов для описания' });

  required(path.estimatedValue, { message: 'Приблизительная стоимость обязательна' });
  min(path.estimatedValue, 0, { message: 'Стоимость должна быть неотрицательной' });
};
