import { defineValidation, validate, type Rule } from '@reformer/core/validation';
import { maxLength, minLength, pattern, required } from '@reformer/core/validators';
import type { Address } from '../../components/nested-forms/Address/types';

const REGION_RULES: Rule<string>[] = [
  required({ code: 'address.region.required' }),
  minLength(2, { code: 'address.region.minLength' }),
  maxLength(100, { code: 'address.region.maxLength' }),
];

const CITY_RULES: Rule<string>[] = [
  required({ code: 'address.city.required' }),
  minLength(2, { code: 'address.city.minLength' }),
  maxLength(100, { code: 'address.city.maxLength' }),
];

const STREET_RULES: Rule<string>[] = [
  required({ code: 'address.street.required' }),
  minLength(3, { code: 'address.street.minLength' }),
  maxLength(200, { code: 'address.street.maxLength' }),
];

const HOUSE_RULES: Rule<string>[] = [
  required({ code: 'address.house.required' }),
  maxLength(10, { code: 'address.house.maxLength' }),
];

const APARTMENT_RULES: Rule<string>[] = [maxLength(10, { code: 'address.apartment.maxLength' })];

const POSTAL_CODE_RULES: Rule<string>[] = [
  required({ code: 'address.postalCode.required' }),
  pattern(/^\d{6}$/, { code: 'address.postalCode.pattern' }),
];

/** Правила адреса: объявлены один раз, подключаются к адресу регистрации и проживания. */
export const addressRules = defineValidation<Address>(({ model }) => {
  validate(model.$.region, REGION_RULES);
  validate(model.$.city, CITY_RULES);
  validate(model.$.street, STREET_RULES);
  validate(model.$.house, HOUSE_RULES);
  validate(model.$.apartment, APARTMENT_RULES);
  validate(model.$.postalCode, POSTAL_CODE_RULES);
});
