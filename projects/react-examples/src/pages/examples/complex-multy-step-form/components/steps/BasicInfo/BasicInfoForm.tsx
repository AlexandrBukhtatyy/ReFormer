import type { GroupNodeWithControls } from 'reformer';
import { FormField } from 'reformer/components';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface BasicInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  const loanType = control.loanType.value.value;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Основная информация о кредите</h2>
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      <FormField control={control.loanTerm} />
      <FormField control={control.loanPurpose} />

      {loanType === 'mortgage' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о недвижимости</h3>
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </>
      )}

      {loanType === 'car' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация об автомобиле</h3>
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} />
            <FormField control={control.carPrice} />
          </div>
        </>
      )}
    </div>
  );
}
