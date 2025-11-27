import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { ExistingLoan } from '../types/credit-application.types';

interface ExistingLoanFormProps {
  control: GroupNodeWithControls<ExistingLoan>;
}

const ExistingLoanFormComponent = ({ control }: ExistingLoanFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.bank} testId="loan-bank" />
        <FormField control={control.type} testId="loan-type" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.amount} testId="loan-amount" />
        <FormField control={control.remainingAmount} testId="loan-remainingAmount" />
        <FormField control={control.monthlyPayment} testId="loan-monthlyPayment" />
      </div>

      <FormField control={control.maturityDate} testId="loan-maturityDate" />
    </div>
  );
};

export const ExistingLoanForm = memo(ExistingLoanFormComponent);
