import { required, min } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { ExistingLoan } from './type';

export const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
  path: FieldPath<ExistingLoan>
) => {
  required(path.bank, { message: 'Название банка обязательно' });

  required(path.amount, { message: 'Сумма кредита обязательна' });
  min(path.amount, 0, { message: 'Сумма должна быть неотрицательной' });

  min(path.remainingAmount, 0, { message: 'Остаток должен быть неотрицательным' });

  required(path.monthlyPayment, { message: 'Ежемесячный платёж обязателен' });
  min(path.monthlyPayment, 0, { message: 'Ежемесячный платёж должен быть неотрицательным' });
};
