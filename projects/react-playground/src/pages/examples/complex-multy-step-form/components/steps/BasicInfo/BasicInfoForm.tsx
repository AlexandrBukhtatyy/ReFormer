import type { FormProxy } from '@reformer/core';
import { useFormControlValue } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import type { CreditApplicationForm, LoanType } from '../../../types/credit-application';

interface BasicInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  const loanType = useFormControlValue(control.loanType) as LoanType;

  return (
    <div className="space-y-6" data-testid="step-basic-info">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Основная информация о кредите
      </h2>
      <FormField control={control.loanType} testId="loanType" />
      <FormField control={control.loanAmount} testId="loanAmount" />
      <FormField control={control.loanTerm} testId="loanTerm" />
      {loanType !== 'mortgage' && loanType !== 'car' && (
        <FormField control={control.loanPurpose} testId="loanPurpose" />
      )}

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

      {loanType === 'business' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о бизнесе</h3>
          <FormField control={control.businessType} testId="businessType" />
          <FormField control={control.businessInn} testId="businessInn" />
          <FormField control={control.businessActivity} testId="businessActivity" />
        </>
      )}
    </div>
  );
}
