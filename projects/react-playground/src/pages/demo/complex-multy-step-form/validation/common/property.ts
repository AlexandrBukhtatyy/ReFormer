import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { maxLength, min, minLength, required } from '@reformer/core/validators';
import type { Property, PropertyType } from '../../components/nested-forms/Property/types';

const TYPE_RULES: Rule<PropertyType>[] = [required({ message: 'Укажите тип имущества' })];

const DESCRIPTION_RULES: Rule<string>[] = [
  required({ message: 'Добавьте описание имущества' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(500, { message: 'Максимум 500 символов' }),
];

const ESTIMATED_VALUE_RULES: Rule<number>[] = [
  required({ message: 'Укажите оценочную стоимость' }),
  min(10000, { message: 'Минимальная стоимость: 10 000 ₽' }),
];

export const propertyRules = defineValidationSchema<Property>(({ model }) => {
  validate(model.$.type, TYPE_RULES);
  validate(model.$.description, DESCRIPTION_RULES);
  validate(model.$.estimatedValue, ESTIMATED_VALUE_RULES);
});
