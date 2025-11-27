import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '@/types/credit-application.types';

interface BasicInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  const { value: loanType } = useFormControl(control.loanType);
  const loanTypeValue = loanType as unknown as string;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Basic Loan Information</h2>

      <FormField control={control.loanType} testId="loanType" />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.loanAmount} testId="loanAmount" />
        <FormField control={control.loanTerm} testId="loanTerm" />
      </div>

      <FormField control={control.loanPurpose} testId="loanPurpose" />

      {loanTypeValue === 'mortgage' && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold">Property Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.propertyValue} testId="propertyValue" />
            <FormField control={control.initialPayment} testId="initialPayment" />
          </div>
        </div>
      )}

      {loanTypeValue === 'car' && (
        <div className="space-y-4 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold">Car Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carBrand} testId="carBrand" />
            <FormField control={control.carModel} testId="carModel" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} testId="carYear" />
            <FormField control={control.carPrice} testId="carPrice" />
          </div>
        </div>
      )}
    </div>
  );
}
