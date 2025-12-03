import { disableWhen, copyFrom } from '@reformer/core/behaviors';
import type { BehaviorSchemaFn } from '@reformer/core/behaviors';
import type { FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

export const contactBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Отключить адрес проживания когда совпадает с регистрацией
  disableWhen(path.residenceAddress, (form) => form.sameAsRegistration === true);

  // Копировать адрес регистрации в адрес проживания
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });
};
