import { required, minLength } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 6: Подтверждение
 */
export const confirmationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Обязательные согласия
  required(path.agreePersonalData, { message: 'Необходимо согласие на обработку персональных данных' });
  required(path.agreeCreditHistory, { message: 'Необходимо согласие на проверку кредитной истории' });
  required(path.agreeTerms, { message: 'Необходимо согласие с условиями кредитования' });
  required(path.confirmAccuracy, { message: 'Необходимо подтверждение достоверности данных' });

  // Электронная подпись
  required(path.electronicSignature, { message: 'Введите код из СМС' });
  minLength(path.electronicSignature, 4, { message: 'Код должен содержать минимум 4 символа' });
};
