import {
  validate,
  required,
  min,
  minLength,
  email,
  phone,
  applyWhen,
  notEmpty,
  validateItems,
} from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';
import type { Property } from '../../sub-forms/property/type';
import type { ExistingLoan } from '../../sub-forms/existing-loan/type';
import type { CoBorrower } from '../../sub-forms/co-borrower/type';

const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  validate(path.type, required({ message: 'Тип имущества обязателен' }));
  validate(path.description, required({ message: 'Описание имущества обязательно' }));
  validate(path.description, minLength(10, { message: 'Минимум 10 символов для описания' }));
  validate(path.estimatedValue, required({ message: 'Приблизительная стоимость обязательна' }));
  validate(path.estimatedValue, min(0, { message: 'Стоимость должна быть неотрицательной' }));
};

const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
  path: FieldPath<ExistingLoan>
) => {
  validate(path.bank, required({ message: 'Название банка обязательно' }));
  validate(path.amount, required({ message: 'Сумма кредита обязательна' }));
  validate(path.amount, min(0, { message: 'Сумма должна быть неотрицательной' }));
  validate(path.remainingAmount, min(0, { message: 'Остаток должен быть неотрицательным' }));
  validate(path.monthlyPayment, required({ message: 'Ежемесячный платёж обязателен' }));
  validate(
    path.monthlyPayment,
    min(0, { message: 'Ежемесячный платёж должен быть неотрицательным' })
  );
};

const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));
  validate(path.phone, required({ message: 'Номер телефона обязателен' }));
  validate(path.phone, phone({ message: 'Неверный формат телефона' }));
  validate(path.email, required({ message: 'Email обязателен' }));
  validate(path.email, email({ message: 'Неверный формат email' }));
  validate(path.monthlyIncome, required({ message: 'Ежемесячный доход обязателен' }));
  validate(path.monthlyIncome, min(0, { message: 'Доход должен быть неотрицательным' }));
  validate(path.relationship, required({ message: 'Связь с заявителем обязательна' }));
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
      validate(p.properties, notEmpty({ message: 'Добавьте хотя бы одно имущество' }));
    }
  );

  validate(path.properties, (properties) => {
    const arr = properties as unknown[] | undefined;
    if (!arr || arr.length <= 10) return null;
    return { code: 'maxArrayLength', message: 'Максимум 10 имущества разрешено' };
  });

  validateItems(path.properties, propertyValidation);

  // Массив существующих кредитов
  applyWhen(
    path.hasExistingLoans,
    (has) => has === true,
    (p) => {
      validate(p.existingLoans, notEmpty({ message: 'Добавьте хотя бы один существующий кредит' }));
    }
  );

  validate(path.existingLoans, (loans) => {
    const arr = loans as unknown[] | undefined;
    if (!arr || arr.length <= 20) return null;
    return { code: 'maxArrayLength', message: 'Максимум 20 кредитов разрешено' };
  });

  validateItems(path.existingLoans, existingLoanValidation);

  // Массив созаёмщиков
  applyWhen(
    path.hasCoBorrower,
    (has) => has === true,
    (p) => {
      validate(p.coBorrowers, notEmpty({ message: 'Добавьте хотя бы одного созаёмщика' }));
    }
  );

  validate(path.coBorrowers, (coBorrowers) => {
    const arr = coBorrowers as unknown[] | undefined;
    if (!arr || arr.length <= 5) return null;
    return { code: 'maxArrayLength', message: 'Максимум 5 созаёмщиков разрешено' };
  });

  validateItems(path.coBorrowers, coBorrowerValidation);
};
