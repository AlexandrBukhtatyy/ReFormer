import {
  defineValidationSchema,
  validate,
  validateAsync,
  type AsyncRule,
  type Rule,
} from '@reformer/core/validation';
import { maxLength, minLength, pattern, required } from '@reformer/core/validators';
import type { CreditApplicationForm } from '../types/credit-application';

const AGREE_PERSONAL_DATA_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие на обработку ПД обязательно' }),
];

const AGREE_CREDIT_HISTORY_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие на проверку кредитной истории обязательно' }),
];

const AGREE_TERMS_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие с условиями обязательно' }),
];

const CONFIRM_ACCURACY_RULES: Rule<boolean>[] = [
  required({ message: 'Подтверждение точности обязательно' }),
];

const ELECTRONIC_SIGNATURE_RULES: Rule<string>[] = [
  required({ message: 'Введите код из СМС' }),
  minLength(6, { message: 'Код — 6 символов' }),
  maxLength(6, { message: 'Код — 6 символов' }),
  pattern(/^\d{6}$/, { message: 'Только цифры' }),
];

/** Код из СМС (демо: 123456). */
const smsCode: AsyncRule<string> = async (value) => {
  if (!value || value.length !== 6) return null;
  await new Promise((resolve) => setTimeout(resolve, 200));
  return value !== '123456'
    ? {
        code: 'invalidSmsCode',
        message: 'Неверный код подтверждения. Для демо используйте: 123456',
      }
    : null;
};

export const confirmationRules = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.agreePersonalData, AGREE_PERSONAL_DATA_RULES);
  validate(model.$.agreeCreditHistory, AGREE_CREDIT_HISTORY_RULES);
  validate(model.$.agreeTerms, AGREE_TERMS_RULES);
  validate(model.$.confirmAccuracy, CONFIRM_ACCURACY_RULES);
  validate(model.$.electronicSignature, ELECTRONIC_SIGNATURE_RULES);
  validateAsync(model.$.electronicSignature, [smsCode]);
});
