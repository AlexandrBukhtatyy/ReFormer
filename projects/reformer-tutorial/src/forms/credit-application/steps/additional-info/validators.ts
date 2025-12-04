import {
  required,
  min,
  minLength,
  email,
  phone,
  applyWhen,
  notEmpty,
  validateItems,
  validate,
} from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';
import type { Property } from '../../sub-forms/property/type';
import type { ExistingLoan } from '../../sub-forms/existing-loan/type';
import type { CoBorrower } from '../../sub-forms/co-borrower/type';

const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.type, { message: 'Тип имущества обязателен' });
  required(path.description, { message: 'Описание имущества обязательно' });
  minLength(path.description, 10, { message: 'Минимум 10 символов для описания' });
  required(path.estimatedValue, { message: 'Приблизительная стоимость обязательна' });
  min(path.estimatedValue, 0, { message: 'Стоимость должна быть неотрицательной' });
};

const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
  path: FieldPath<ExistingLoan>
) => {
  required(path.bank, { message: 'Название банка обязательно' });
  required(path.amount, { message: 'Сумма кредита обязательна' });
  min(path.amount, 0, { message: 'Сумма должна быть неотрицательной' });
  min(path.remainingAmount, 0, { message: 'Остаток должен быть неотрицательным' });
  required(path.monthlyPayment, { message: 'Ежемесячный платёж обязателен' });
  min(path.monthlyPayment, 0, { message: 'Ежемесячный платёж должен быть неотрицательным' });
};

const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.personalData.firstName, { message: 'Имя обязательно' });
  required(path.personalData.lastName, { message: 'Фамилия обязательна' });
  required(path.phone, { message: 'Номер телефона обязателен' });
  phone(path.phone, { message: 'Неверный формат телефона' });
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 0, { message: 'Доход должен быть неотрицательным' });
  required(path.relationship, { message: 'Связь с заявителем обязательна' });
};

/**
 * Валидация для Шага 5: Дополнительная информация
 */
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Массив имущества
  applyWhen(
    path.hasProperty,
    (has) => has === true,
    (p) => {
      notEmpty(p.properties, { message: 'Добавьте хотя бы одно имущество' });
    }
  );

  validate(path.properties, (properties) => {
    if (!properties || properties.length <= 10) return null;
    return { code: 'maxArrayLength', message: 'Максимум 10 имущества разрешено' };
  });

  validateItems(path.properties, propertyValidation);

  // Массив существующих кредитов
  applyWhen(
    path.hasExistingLoans,
    (has) => has === true,
    (p) => {
      notEmpty(p.existingLoans, { message: 'Добавьте хотя бы один существующий кредит' });
    }
  );

  validate(path.existingLoans, (loans) => {
    if (!loans || loans.length <= 20) return null;
    return { code: 'maxArrayLength', message: 'Максимум 20 кредитов разрешено' };
  });

  validateItems(path.existingLoans, existingLoanValidation);

  // Массив созаёмщиков
  applyWhen(
    path.hasCoBorrower,
    (has) => has === true,
    (p) => {
      notEmpty(p.coBorrowers, { message: 'Добавьте хотя бы одного созаёмщика' });
    }
  );

  validate(path.coBorrowers, (coBorrowers) => {
    if (!coBorrowers || coBorrowers.length <= 5) return null;
    return { code: 'maxArrayLength', message: 'Максимум 5 созаёмщиков разрешено' };
  });

  validateItems(path.coBorrowers, coBorrowerValidation);
};
