import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import {
  applyWhen,
  validate,
  validateGroup,
  required,
  min,
  max,
  minLength,
  maxLength,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../../../types/credit-application';

/**
 * Схема валидации для Шага 1: Основная информация о кредите.
 */
export const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  validate(path.loanType, required({ message: 'Выберите тип кредита' }));

  validate(path.loanAmount, required({ message: 'Укажите сумму кредита' }));
  validate(path.loanAmount, min(50000, { message: 'Минимальная сумма кредита: 50 000 ₽' }));
  validate(path.loanAmount, max(10000000, { message: 'Максимальная сумма кредита: 10 000 000 ₽' }));

  validate(path.loanTerm, required({ message: 'Укажите срок кредита' }));
  validate(path.loanTerm, min(6, { message: 'Минимальный срок: 6 месяцев' }));
  validate(path.loanTerm, max(240, { message: 'Максимальный срок: 240 месяцев (20 лет)' }));

  validate(path.loanPurpose, required({ message: 'Укажите цель кредита' }));
  validate(
    path.loanPurpose,
    minLength(10, { message: 'Опишите цель подробнее (минимум 10 символов)' })
  );
  validate(path.loanPurpose, maxLength(500));

  // Условная валидация для ипотеки
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      validate(path.propertyValue, required({ message: 'Укажите стоимость недвижимости' }));
      validate(path.propertyValue, min(1000000, { message: 'Минимальная стоимость: 1 000 000 ₽' }));

      validate(path.initialPayment, required({ message: 'Укажите первоначальный взнос' }));
      validate(path.initialPayment, min(0));

      // Cross-field валидация для первоначального взноса
      validateGroup(
        path,
        (scope) => {
          const form = scope.getValue();

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
              message: 'Первоначальный взнос не может быть меньше 20% от стоимости недвижимости',
            };
          }
          return null;
        },
        { targetField: path.initialPayment }
      );

      // Cross-field: сумма кредита ≤ (стоимость - взнос)
      validateGroup(
        path,
        (scope) => {
          const form = scope.getValue();

          if (form.loanAmount && form.propertyValue && form.initialPayment) {
            const maxLoanAmount = form.propertyValue - form.initialPayment;
            if (form.loanAmount > maxLoanAmount) {
              return {
                code: 'loanAmountExceedsMax',
                message: `Сумма кредита не может превышать ${maxLoanAmount.toLocaleString('ru-RU')} ₽ (стоимость недвижимости минус первоначальный взнос)`,
              };
            }
          }
          return null;
        },
        { targetField: path.loanAmount }
      );
    }
  );

  // Условная валидация для автокредита
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (path) => {
      validate(path.carBrand, required({ message: 'Укажите марку автомобиля' }));
      validate(path.carBrand, minLength(2, { message: 'Минимум 2 символа' }));
      validate(path.carBrand, maxLength(50, { message: 'Максимум 50 символов' }));

      validate(path.carModel, required({ message: 'Укажите модель автомобиля' }));
      validate(path.carModel, minLength(1, { message: 'Минимум 1 символ' }));
      validate(path.carModel, maxLength(50, { message: 'Максимум 50 символов' }));

      validate(path.carYear, required({ message: 'Укажите год выпуска' }));
      validate(path.carYear, min(2000, { message: 'Год выпуска не ранее 2000' }));
      validate(
        path.carYear,
        max(new Date().getFullYear() + 1, {
          message: `Год выпуска не позднее ${new Date().getFullYear() + 1}`,
        })
      );

      validate(path.carPrice, required({ message: 'Укажите стоимость автомобиля' }));
      validate(path.carPrice, min(300000, { message: 'Минимальная стоимость: 300 000 ₽' }));
      validate(path.carPrice, max(10000000, { message: 'Максимальная стоимость: 10 000 000 ₽' }));
    }
  );
};
