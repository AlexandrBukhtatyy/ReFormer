import { required, min, max, minLength, maxLength, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../type';

/**
 * Валидация для Шага 1: Информация о кредите
 *
 * Валидирует:
 * - Обязательные поля (loanType, loanAmount, loanTerm, loanPurpose)
 * - Числовые диапазоны (сумма, срок)
 * - Условные поля ипотеки (propertyValue, initialPayment)
 * - Условные поля автокредита (carBrand, carModel, carYear, carPrice)
 */
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Тип кредита
  required(path.loanType, { message: 'Пожалуйста, выберите тип кредита' });

  // Сумма кредита
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма: 50 000' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма: 10 000 000' });

  // Срок кредита
  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 360, { message: 'Максимальный срок: 360 месяцев (30 лет)' });

  // Цель кредита
  required(path.loanPurpose, { message: 'Цель кредита обязательна' });
  minLength(path.loanPurpose, 10, { message: 'Пожалуйста, укажите не менее 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  // Условно: Поля ипотеки
  applyWhen(
    path.loanType,
    (loanType) => loanType === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Стоимость имущества обязательна для ипотеки' });
      min(p.propertyValue, 1000000, { message: 'Минимальная стоимость имущества: 1 000 000' });
      max(p.propertyValue, 500000000, { message: 'Максимальная стоимость имущества: 500 000 000' });

      required(p.initialPayment, { message: 'Первоначальный платёж обязателен для ипотеки' });
      min(p.initialPayment, 100000, { message: 'Минимальный первоначальный платёж: 100 000' });
    }
  );

  // Условно: Поля автокредита
  const currentYear = new Date().getFullYear();

  applyWhen(
    path.loanType,
    (loanType) => loanType === 'car',
    (p) => {
      required(p.carBrand, { message: 'Марка автомобиля обязательна' });
      required(p.carModel, { message: 'Модель автомобиля обязательна' });

      required(p.carYear, { message: 'Год выпуска обязателен' });
      min(p.carYear, 2000, { message: 'Автомобиль должен быть 2000 года или новее' });
      max(p.carYear, currentYear + 1, { message: `Максимальный год: ${currentYear + 1}` });

      required(p.carPrice, { message: 'Цена автомобиля обязательна' });
      min(p.carPrice, 100000, { message: 'Минимальная цена автомобиля: 100 000' });
      max(p.carPrice, 20000000, { message: 'Максимальная цена автомобиля: 20 000 000' });
    }
  );
};
