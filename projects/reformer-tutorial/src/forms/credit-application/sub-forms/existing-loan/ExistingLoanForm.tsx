import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { ExistingLoan } from './type';

interface ExistingLoanFormProps {
  control: GroupNodeWithControls<ExistingLoan>;
}

const ExistingLoanFormComponent = ({ control }: ExistingLoanFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.bank} />
        <FormField control={control.type} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.amount} />
        <FormField control={control.remainingAmount} />
        <FormField control={control.monthlyPayment} />
      </div>

      <FormField control={control.maturityDate} />
    </div>
  );
};

export const ExistingLoanForm = memo(ExistingLoanFormComponent);
