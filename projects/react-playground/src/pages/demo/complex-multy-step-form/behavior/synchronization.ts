import { copyFrom, type BehaviorScope } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from '../types/credit-application';
import { blankAddress } from '../model/factories/address';
import { clearWhenOff, resetOnUnset } from './operators';

/**
 * Согласованность значений: копии полей под флагом, их очистка при снятии флага и очистка
 * списков при снятом флаге.
 */
export function synchronization({ model, form }: BehaviorScope<CreditApplicationForm>): void {
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
  copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
    when: () => model.sameAsRegistration === true,
  });
  // Снятый флаг уносит скопированное: адрес и почту человек вводит с чистого поля.
  resetOnUnset(model.$.sameEmail, form.emailAdditional, () => '');
  resetOnUnset(model.$.sameAsRegistration, form.residenceAddress, blankAddress);

  clearWhenOff(model.$.hasProperty, form.properties);
  clearWhenOff(model.$.hasExistingLoans, form.existingLoans);
  clearWhenOff(model.$.hasCoBorrower, form.coBorrowers);
}
