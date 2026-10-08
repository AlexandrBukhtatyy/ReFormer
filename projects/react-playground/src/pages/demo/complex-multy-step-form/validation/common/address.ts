import { defineValidationSchema, validate, type Rule } from '@reformer/core/validation';
import { maxLength, minLength, pattern, required } from '@reformer/core/validators';
import type { Address } from '../../components/nested-forms/Address/types';

const REGION_RULES: Rule<string>[] = [
  required({ message: 'Укажите регион' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const CITY_RULES: Rule<string>[] = [
  required({ message: 'Укажите город' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const STREET_RULES: Rule<string>[] = [
  required({ message: 'Укажите улицу' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const HOUSE_RULES: Rule<string>[] = [
  required({ message: 'Укажите номер дома' }),
  maxLength(10, { message: 'Максимум 10 символов' }),
];

const APARTMENT_RULES: Rule<string>[] = [maxLength(10, { message: 'Максимум 10 символов' })];

const POSTAL_CODE_RULES: Rule<string>[] = [
  required({ message: 'Укажите почтовый индекс' }),
  pattern(/^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' }),
];

/** Правила адреса: объявлены один раз, подключаются к адресу регистрации и проживания. */
export const addressRules = defineValidationSchema<Address>(({ model }) => {
  validate(model.$.region, REGION_RULES);
  validate(model.$.city, CITY_RULES);
  validate(model.$.street, STREET_RULES);
  validate(model.$.house, HOUSE_RULES);
  validate(model.$.apartment, APARTMENT_RULES);
  validate(model.$.postalCode, POSTAL_CODE_RULES);
});
