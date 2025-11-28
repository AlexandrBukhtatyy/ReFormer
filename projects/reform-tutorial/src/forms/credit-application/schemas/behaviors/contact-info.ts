import { disableWhen, copyFrom } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

export const contactBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Отключить адрес проживания когда совпадает с регистрацией
  // ==========================================
  disableWhen(path.residenceAddress, (form) => form.sameAsRegistration === true);

  // ==========================================
  // Копировать адрес регистрации в адрес проживания
  // ==========================================
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });
};
