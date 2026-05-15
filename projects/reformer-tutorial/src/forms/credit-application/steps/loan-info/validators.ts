import {
  validate,
  required,
  min,
  max,
  minLength,
  maxLength,
  applyWhen,
} from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 1: Информация о кредите
 */
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Тип кредита
  validate(path.loanType, required({ message: 'Пожалуйста, выберите тип кредита' }));

  // Сумма кредита
  validate(path.loanAmount, required({ message: 'Сумма кредита обязательна' }));
  validate(path.loanAmount, min(50000, { message: 'Минимальная сумма: 50 000' }));
  validate(path.loanAmount, max(10000000, { message: 'Максимальная сумма: 10 000 000' }));

  // Срок кредита
  validate(path.loanTerm, required({ message: 'Срок кредита обязателен' }));
  validate(path.loanTerm, min(6, { message: 'Минимальный срок: 6 месяцев' }));
  validate(path.loanTerm, max(360, { message: 'Максимальный срок: 360 месяцев (30 лет)' }));

  // Цель кредита
  validate(path.loanPurpose, required({ message: 'Цель кредита обязательна' }));
  validate(
    path.loanPurpose,
    minLength(10, { message: 'Пожалуйста, укажите не менее 10 символов' })
  );
  validate(path.loanPurpose, maxLength(500, { message: 'Максимум 500 символов' }));

  // Условно: Поля ипотеки
  applyWhen(
    path.loanType,
    (loanType) => loanType === 'mortgage',
    (p) => {
      validate(
        p.propertyValue,
        required({ message: 'Стоимость имущества обязательна для ипотеки' })
      );
      validate(
        p.propertyValue,
        min(1000000, { message: 'Минимальная стоимость имущества: 1 000 000' })
      );
      validate(
        p.propertyValue,
        max(500000000, { message: 'Максимальная стоимость имущества: 500 000 000' })
      );

      validate(
        p.initialPayment,
        required({ message: 'Первоначальный платёж обязателен для ипотеки' })
      );
      validate(
        p.initialPayment,
        min(100000, { message: 'Минимальный первоначальный платёж: 100 000' })
      );
    }
  );

  // Условно: Поля автокредита
  const currentYear = new Date().getFullYear();

  applyWhen(
    path.loanType,
    (loanType) => loanType === 'car',
    (p) => {
      validate(p.carBrand, required({ message: 'Марка автомобиля обязательна' }));
      validate(p.carModel, required({ message: 'Модель автомобиля обязательна' }));

      validate(p.carYear, required({ message: 'Год выпуска обязателен' }));
      validate(p.carYear, min(2000, { message: 'Автомобиль должен быть 2000 года или новее' }));
      validate(
        p.carYear,
        max(currentYear + 1, { message: `Максимальный год: ${currentYear + 1}` })
      );

      validate(p.carPrice, required({ message: 'Цена автомобиля обязательна' }));
      validate(p.carPrice, min(100000, { message: 'Минимальная цена автомобиля: 100 000' }));
      validate(p.carPrice, max(20000000, { message: 'Максимальная цена автомобиля: 20 000 000' }));
    }
  );
};
