import type { ValidationError } from '@reformer/core';
import {
  apply,
  defineValidationSchema,
  validate,
  validateWhen,
  type Rule,
} from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { livesElsewhere } from '../model/predicates';
import type { CreditApplicationForm } from '../types/credit-application';
import { addressRules } from './common/address';
import { EMAIL_FORMAT_RULES, EMAIL_REQUIRED_RULES, PHONE_FORMAT_RULES } from './common/rules';

const PHONE_MAIN_RULES: Rule<string>[] = [
  required({ message: 'Телефон обязателен' }),
  ...PHONE_FORMAT_RULES,
];

const additionalPhoneDiffers = (application: CreditApplicationForm): ValidationError | null => {
  if (!application.phoneAdditional) return null;
  return application.phoneMain === application.phoneAdditional
    ? { code: 'phoneDuplicate', message: 'Дополнительный телефон должен отличаться от основного' }
    : null;
};

const additionalEmailDiffers = (application: CreditApplicationForm): ValidationError | null => {
  if (!application.emailAdditional) return null;
  return application.email.toLowerCase() === application.emailAdditional.toLowerCase()
    ? { code: 'emailDuplicate', message: 'Дополнительный email должен отличаться от основного' }
    : null;
};

export const contactsRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  validate(model.$.phoneMain, PHONE_MAIN_RULES);
  validate(model.$.phoneAdditional, PHONE_FORMAT_RULES);
  cross(model.$.phoneAdditional, additionalPhoneDiffers);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.emailAdditional, EMAIL_FORMAT_RULES);
  cross(model.$.emailAdditional, additionalEmailDiffers);
  apply(model.$.registrationAddress, addressRules);
  // Адрес проживания проверяется, только если он не совпадает с адресом регистрации
  validateWhen(
    () => livesElsewhere(model.sameAsRegistration),
    () => apply(model.$.residenceAddress, addressRules)
  );
});
