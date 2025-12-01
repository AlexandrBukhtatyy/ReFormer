import type { GroupNodeWithControls } from 'reformer';
import { useFormControlValue } from 'reformer';
import type { CreditApplicationForm } from '../../type';
import { FormField } from '@/components/ui/FormField';

interface BasicInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  // Подписка ТОЛЬКО на значение loanType (не на errors, valid и т.д.)
  const loanType = useFormControlValue(control.loanType);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Основная информация о кредите</h2>

      {/* Общие поля */}
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      <FormField control={control.loanTerm} />
      <FormField control={control.loanPurpose} />

      {/* Условные поля: Ипотека */}
      {loanType === 'mortgage' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Информация о недвижимости</h3>
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </>
      )}

      {/* Условные поля: Автокредит */}
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
