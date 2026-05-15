import { validate, required, minLength } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 6: Подтверждение
 */
export const confirmationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Обязательные согласия
  validate(
    path.agreePersonalData,
    required({ message: 'Необходимо согласие на обработку персональных данных' })
  );
  validate(
    path.agreeCreditHistory,
    required({ message: 'Необходимо согласие на проверку кредитной истории' })
  );
  validate(path.agreeTerms, required({ message: 'Необходимо согласие с условиями кредитования' }));
  validate(
    path.confirmAccuracy,
    required({ message: 'Необходимо подтверждение достоверности данных' })
  );

  // Электронная подпись
  validate(path.electronicSignature, required({ message: 'Введите код из СМС' }));
  validate(
    path.electronicSignature,
    minLength(4, { message: 'Код должен содержать минимум 4 символа' })
  );
};
