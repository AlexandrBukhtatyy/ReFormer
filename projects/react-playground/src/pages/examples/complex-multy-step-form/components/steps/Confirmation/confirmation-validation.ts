import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import {
  validate,
  validateAsync,
  required,
  minLength,
  maxLength,
  pattern,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

/**
 * Схема валидации для Шага 6: Согласия и подтверждение
 */
export const confirmationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Обязательные согласия (boolean === true проверяется внутри required())
  validate(
    path.agreePersonalData,
    required({ message: 'Согласие на обработку персональных данных обязательно' })
  );
  validate(
    path.agreeCreditHistory,
    required({ message: 'Согласие на получение кредитной истории обязательно' })
  );
  validate(path.agreeTerms, required({ message: 'Согласие с условиями кредитования обязательно' }));
  validate(
    path.confirmAccuracy,
    required({ message: 'Подтверждение точности данных обязательно' })
  );

  // Согласие на маркетинговые рассылки — опциональное.

  // Электронная подпись (код из СМС)
  validate(path.electronicSignature, required({ message: 'Введите код из СМС' }));
  validate(path.electronicSignature, minLength(6, { message: 'Код должен содержать 6 символов' }));
  validate(path.electronicSignature, maxLength(6, { message: 'Код должен содержать 6 символов' }));
  validate(
    path.electronicSignature,
    pattern(/^\d{6}$/, { message: 'Код должен содержать только цифры' })
  );

  // Async проверка кода подписи
  validateAsync(
    path.electronicSignature,
    async (value) => {
      if (!value || value.length !== 6) return null;

      await new Promise((resolve) => setTimeout(resolve, 500));

      if (value !== '123456') {
        return {
          code: 'invalidSmsCode',
          message: 'Неверный код подтверждения. Для демо используйте: 123456',
        };
      }

      return null;
    },
    { debounce: 500 }
  );
};
