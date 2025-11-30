import { enableWhen, copyFrom } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../../types/credit-application.types';

export const step3ContactBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Hide/Disable Residence Address When Same as Registration
  // Using enableWhen (show when NOT same as registration)
  // ==========================================
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration !== true);

  // ==========================================
  // Copy Registration Address to Residence Address
  // ==========================================
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });
};
