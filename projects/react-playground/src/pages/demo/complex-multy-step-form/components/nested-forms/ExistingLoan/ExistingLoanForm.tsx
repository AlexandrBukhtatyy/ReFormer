import { memo } from 'react';
import type { FormProxy } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import type { ExistingLoan } from './types';

export type { ExistingLoan } from './types';

interface ExistingLoanFormProps {
  control: FormProxy<ExistingLoan>;
}

const ExistingLoanFormComponent = ({ control }: ExistingLoanFormProps) => {
  return (
    <div className="space-y-3">
      <FormField control={control.bank} testId="existingLoan-bank" />
      <FormField control={control.type} testId="existingLoan-type" />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.amount} testId="existingLoan-amount" />
        <FormField control={control.remainingAmount} testId="existingLoan-remainingAmount" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.monthlyPayment} testId="existingLoan-monthlyPayment" />
        <FormField control={control.maturityDate} testId="existingLoan-maturityDate" />
      </div>
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const ExistingLoanForm = memo(ExistingLoanFormComponent);
