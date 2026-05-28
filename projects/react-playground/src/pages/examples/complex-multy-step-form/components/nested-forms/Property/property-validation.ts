/**
 * Validation schema для Property.
 *
 * Применяется к каждому элементу массива properties через ArrayNode.applyValidationSchema().
 */

import {
  createFieldPath,
  validate,
  required,
  minLength,
  maxLength,
  min,
} from '@reformer/core/validators';
import type { Property } from './PropertyForm';

/**
 * Валидация элемента имущества
 */
export const propertyValidation = (path: ReturnType<typeof createFieldPath<Property>>) => {
  validate(path.type, required({ message: 'Укажите тип имущества' }));

  validate(path.description, required({ message: 'Добавьте описание имущества' }));
  validate(
    path.description,
    minLength(10, { message: 'Описание должно содержать минимум 10 символов' })
  );
  validate(
    path.description,
    maxLength(500, { message: 'Описание не может превышать 500 символов' })
  );

  validate(path.estimatedValue, required({ message: 'Укажите оценочную стоимость' }));
  validate(
    path.estimatedValue,
    min(10000, { message: 'Минимальная стоимость имущества: 10 000 ₽' })
  );
};
