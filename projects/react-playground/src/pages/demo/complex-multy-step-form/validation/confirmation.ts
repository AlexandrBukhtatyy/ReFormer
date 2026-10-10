import {
  defineValidation,
  validate,
  validateAsync,
  type AsyncRule,
  type Rule,
} from '@reformer/core/validation';
import { maxLength, minLength, pattern, required } from '@reformer/core/validators';
import type { CreditApplicationForm } from '../types/credit-application';

const AGREE_PERSONAL_DATA_RULES: Rule<boolean>[] = [
  required({ code: 'agreePersonalData.required' }),
];

const AGREE_CREDIT_HISTORY_RULES: Rule<boolean>[] = [
  required({ code: 'agreeCreditHistory.required' }),
];

const AGREE_TERMS_RULES: Rule<boolean>[] = [required({ code: 'agreeTerms.required' })];

const CONFIRM_ACCURACY_RULES: Rule<boolean>[] = [required({ code: 'confirmAccuracy.required' })];

const ELECTRONIC_SIGNATURE_RULES: Rule<string>[] = [
  required({ code: 'electronicSignature.required' }),
  minLength(6, { code: 'electronicSignature.minLength' }),
  maxLength(6, { code: 'electronicSignature.maxLength' }),
  pattern(/^\d{6}$/, { code: 'electronicSignature.pattern' }),
];

/** Код из СМС (демо: 123456). */
const smsCode: AsyncRule<string> = async (value) => {
  if (!value || value.length !== 6) return null;
  await new Promise((resolve) => setTimeout(resolve, 200));
  return value !== '123456'
    ? {
        code: 'invalidSmsCode',
      }
    : null;
};

export const confirmationRules = defineValidation<CreditApplicationForm>(({ model }) => {
  validate(model.$.agreePersonalData, AGREE_PERSONAL_DATA_RULES);
  validate(model.$.agreeCreditHistory, AGREE_CREDIT_HISTORY_RULES);
  validate(model.$.agreeTerms, AGREE_TERMS_RULES);
  validate(model.$.confirmAccuracy, CONFIRM_ACCURACY_RULES);
  validate(model.$.electronicSignature, ELECTRONIC_SIGNATURE_RULES);
  validateAsync(model.$.electronicSignature, [smsCode]);
});
