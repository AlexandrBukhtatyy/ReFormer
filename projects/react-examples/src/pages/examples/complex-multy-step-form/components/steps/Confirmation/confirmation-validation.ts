import type { FieldPath } from 'reformer';
import { validateAsync, required, minLength, maxLength, pattern } from 'reformer/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

/**
 * Схема валидации для Шага 6: Согласия и подтверждение
 */
export const confirmationValidation = (path: FieldPath<CreditApplicationForm>) => {
  // Согласие на обработку персональных данных (обязательно)
  // required() уже проверяет что boolean === true, дополнительный validate не нужен
  required(path.agreePersonalData, {
    message: 'Согласие на обработку персональных данных обязательно',
  });

  // Согласие на получение кредитной истории (обязательно)
  required(path.agreeCreditHistory, {
    message: 'Согласие на получение кредитной истории обязательно',
  });

  // Согласие с условиями кредитования (обязательно)
  required(path.agreeTerms, { message: 'Согласие с условиями кредитования обязательно' });

  // Подтверждение точности данных (обязательно)
  required(path.confirmAccuracy, { message: 'Подтверждение точности данных обязательно' });

  // Согласие на маркетинговые рассылки (опциональное)
  // Это согласие не требует обязательного true, пользователь может отказаться

  // Электронная подпись (код из СМС)
  required(path.electronicSignature, { message: 'Введите код из СМС' });
  minLength(path.electronicSignature, 6, { message: 'Код должен содержать 6 символов' });
  maxLength(path.electronicSignature, 6, { message: 'Код должен содержать 6 символов' });
  pattern(path.electronicSignature, /^\d{6}$/, {
    message: 'Код должен содержать только цифры',
  });

  // Асинхронная проверка кода подписи
  validateAsync(
    path.electronicSignature,
    async (ctx) => {
      const code = ctx.value();

      // Проверяем только если код полностью введен
      if (!code || code.length !== 6) return null;

      // Для демонстрации: симулируем задержку API
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Пример валидации: код должен быть "123456" для демо
      // В продакшене это должна быть реальная проверка на сервере
      if (code !== '123456') {
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
