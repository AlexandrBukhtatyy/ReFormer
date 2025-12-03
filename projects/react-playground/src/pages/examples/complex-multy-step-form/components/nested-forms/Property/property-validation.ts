/**
 * Validation schema для Property
 *
 * Валидация элементов массива properties.
 * Применяется к каждому элементу через ArrayNode.applyValidationSchema()
 */

import { createFieldPath, required, minLength, maxLength, min } from '@reformer/core/validators';
import type { Property } from './PropertyForm';

/**
 * Валидация элемента имущества
 */
export const propertyValidation = (path: ReturnType<typeof createFieldPath<Property>>) => {
  // Тип имущества обязателен
  required(path.type, { message: 'Укажите тип имущества' });

  // Описание обязательно и должно быть детальным
  required(path.description, { message: 'Добавьте описание имущества' });
  minLength(path.description, 10, {
    message: 'Описание должно содержать минимум 10 символов',
  });
  maxLength(path.description, 500, {
    message: 'Описание не может превышать 500 символов',
  });

  // Оценочная стоимость должна быть адекватной
  required(path.estimatedValue, { message: 'Укажите оценочную стоимость' });
  min(path.estimatedValue, 10000, {
    message: 'Минимальная стоимость имущества: 10 000 ₽',
  });
};
