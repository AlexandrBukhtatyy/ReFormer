import type { GroupNodeWithControls } from '@reformer/core';
import { useFormControl } from '@reformer/core';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface BasicInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-6" data-testid="step-basic-info">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Основная информация о кредите
      </h2>
      <FormField control={control.loanType} testId="loanType" />
      <FormField control={control.loanAmount} testId="loanAmount" />
      <FormField control={control.loanTerm} testId="loanTerm" />
      <FormField control={control.loanPurpose} testId="loanPurpose" />

      {loanType === 'mortgage' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о недвижимости</h3>
          <FormField control={control.propertyValue} testId="propertyValue" />
          <FormField control={control.initialPayment} testId="initialPayment" />
        </>
      )}

      {loanType === 'car' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация об автомобиле</h3>
          <FormField control={control.carBrand} testId="carBrand" />
          <FormField control={control.carModel} testId="carModel" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} testId="carYear" />
            <FormField control={control.carPrice} testId="carPrice" />
          </div>
        </>
      )}
    </div>
  );
}
