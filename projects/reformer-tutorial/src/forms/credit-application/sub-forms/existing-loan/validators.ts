import { validate, required, min } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { ExistingLoan } from './type';

export const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
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
