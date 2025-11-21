import type { FieldPath, ValidationSchemaFn } from 'reformer';
import {
  applyWhen,
  validateTree,
  required,
  min,
  max,
  minLength,
  maxLength,
} from 'reformer/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

/**
 * Схема валидации для Шага 1: Основная информация о кредите
 *
 * ✅ Чистая схема БЕЗ условия на currentStep
 * ✅ Содержит только бизнес-логику валидации полей шага 1
 */
export const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanType, { message: 'Выберите тип кредита' });

  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма кредита: 10 000 000 ₽' });

  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок: 240 месяцев (20 лет)' });

  required(path.loanPurpose, { message: 'Укажите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Опишите цель подробнее (минимум 10 символов)' });
  maxLength(path.loanPurpose, 500);

  // Условная валидация для ипотеки
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      required(path.propertyValue, { message: 'Укажите стоимость недвижимости' });
      min(path.propertyValue, 1000000, { message: 'Минимальная стоимость: 1 000 000 ₽' });

      required(path.initialPayment, { message: 'Укажите первоначальный взнос' });
      min(path.initialPayment, 0);

      // Cross-field валидация
      validateTree<CreditApplicationForm>(
        (ctx) => {
          const form = ctx.form.getValue();

          if (
            form.initialPayment &&
            form.propertyValue &&
            form.initialPayment > form.propertyValue
          ) {
            return {
              code: 'initialPaymentTooHigh',
              message: 'Первоначальный взнос не может превышать стоимость недвижимости',
            };
          }

          if (
            form.initialPayment &&
            form.propertyValue &&
            form.initialPayment < form.propertyValue * 0.2
          ) {
            return {
              code: 'initialPaymentTooLow',
              message: 'Первоначальный взнос не может быть меньше 20% от стоимость недвижимости',
            };
          }
          return null;
        },
        { targetField: 'initialPayment' }
      );
    }
  );

  // Условная валидация для автокредита
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (path) => {
      required(path.carBrand, { message: 'Укажите марку автомобиля' });
      minLength(path.carBrand, 2, { message: 'Минимум 2 символа' });
      maxLength(path.carBrand, 50, { message: 'Максимум 50 символов' });

      required(path.carModel, { message: 'Укажите модель автомобиля' });
      minLength(path.carModel, 1, { message: 'Минимум 1 символ' });
      maxLength(path.carModel, 50, { message: 'Максимум 50 символов' });

      required(path.carYear, { message: 'Укажите год выпуска' });
      min(path.carYear, 2000, { message: 'Год выпуска не ранее 2000' });
      max(path.carYear, new Date().getFullYear() + 1, {
        message: `Год выпуска не позднее ${new Date().getFullYear() + 1}`,
      });

      required(path.carPrice, { message: 'Укажите стоимость автомобиля' });
      min(path.carPrice, 300000, { message: 'Минимальная стоимость: 300 000 ₽' });
      max(path.carPrice, 10000000, { message: 'Максимальная стоимость: 10 000 000 ₽' });
    }
  );
};
