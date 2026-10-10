import { defineValidation, validate, type Rule } from '@reformer/core/validation';
import { maxLength, min, minLength, required } from '@reformer/core/validators';
import type { Property, PropertyType } from '../../components/nested-forms/Property/types';

const TYPE_RULES: Rule<PropertyType>[] = [required({ code: 'property.type.required' })];

const DESCRIPTION_RULES: Rule<string>[] = [
  required({ code: 'property.description.required' }),
  minLength(10, { code: 'property.description.minLength' }),
  maxLength(500, { code: 'property.description.maxLength' }),
];

const ESTIMATED_VALUE_RULES: Rule<number>[] = [
  required({ code: 'property.estimatedValue.required' }),
  min(10000, { code: 'property.estimatedValue.min' }),
];

export const propertyRules = defineValidation<Property>(({ model }) => {
  validate(model.$.type, TYPE_RULES);
  validate(model.$.description, DESCRIPTION_RULES);
  validate(model.$.estimatedValue, ESTIMATED_VALUE_RULES);
});
