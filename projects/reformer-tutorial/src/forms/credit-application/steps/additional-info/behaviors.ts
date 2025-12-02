import { enableWhen, computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';
import type { CoBorrower } from '../../sub-forms/co-borrower/type';

export const additionalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Показать массив имущества когда hasProperty === true
  enableWhen(path.properties, (form) => form.hasProperty === true);

  // Показать массив существующих кредитов когда hasExistingLoans === true
  enableWhen(path.existingLoans, (form) => form.hasExistingLoans === true);

  // Показать массив созаёмщиков когда hasCoBorrower === true
  enableWhen(path.coBorrowers, (form) => form.hasCoBorrower === true);

  // Вычисляемое поле: Общий доход созаёмщиков
  computeFrom([path.coBorrowers], path.coBorrowersIncome, (values) => {
    const coBorrowers = (values.coBorrowers as CoBorrower[]) || [];
    return coBorrowers.reduce((sum, cb) => sum + (cb.monthlyIncome || 0), 0);
  });

  // Отключить coBorrowersIncome (только для чтения)
  disableWhen(path.coBorrowersIncome, () => true);
};
