import { copyFrom, type BehaviorScope } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from '../types/credit-application';
import { clearWhenOff } from './operators';

/** Согласованность значений: копии полей и очистка списков при снятом флаге. */
export function synchronization({ model, form }: BehaviorScope<CreditApplicationForm>): void {
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
  copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
    when: () => model.sameAsRegistration === true,
  });

  clearWhenOff(model.$.hasProperty, form.properties);
  clearWhenOff(model.$.hasExistingLoans, form.existingLoans);
  clearWhenOff(model.$.hasCoBorrower, form.coBorrowers);
}
