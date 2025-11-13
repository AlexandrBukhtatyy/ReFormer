import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface EmploymentFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function EmploymentForm({ control }: EmploymentFormProps) {
  const employmentStatus = control.employmentStatus.value.value;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Информация о занятости</h2>

      <div className="space-y-4">
        <FormField control={control.employmentStatus} />
      </div>

      {employmentStatus === 'employed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mt-6">Информация о работодателе</h3>
          <FormField control={control.companyName} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.companyInn} />
            <FormField control={control.companyPhone} />
          </div>
          <FormField control={control.companyAddress} />

          <h3 className="text-lg font-semibold mt-6">Должность и стаж</h3>
          <FormField control={control.position} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.workExperienceTotal} />
            <FormField control={control.workExperienceCurrent} />
          </div>
        </div>
      )}

      {employmentStatus === 'selfEmployed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mt-6">Информация о бизнесе</h3>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </div>
      )}

      {employmentStatus !== 'unemployed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mt-6">Доход</h3>
          <FormField control={control.monthlyIncome} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.additionalIncome} />
            <FormField control={control.additionalIncomeSource} />
          </div>
        </div>
      )}

      {employmentStatus === 'unemployed' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mt-6">
          <p className="text-sm text-yellow-800">
            Обратите внимание: для получения кредита без подтвержденного дохода могут потребоваться
            дополнительные документы и поручители.
          </p>
        </div>
      )}
    </div>
  );
}
