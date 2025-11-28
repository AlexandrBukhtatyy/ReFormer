import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import type { CreditApplicationForm } from '../types/credit-application.types';
import { FormField } from '@/components/ui/FormField';

interface EmploymentFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function EmploymentForm({ control }: EmploymentFormProps) {
  const { value: employmentStatus } = useFormControl<CreditApplicationForm['employmentStatus']>(
    control.employmentStatus
  );

  const isEmployed = employmentStatus === 'employed';
  const isSelfEmployed = employmentStatus === 'selfEmployed';

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Информация о занятости</h2>

      <FormField control={control.employmentStatus} />

      {/* Секция для работающих */}
      {isEmployed && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold">Информация о компании</h3>
          <FormField control={control.companyName} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.companyInn} />
            <FormField control={control.companyPhone} />
          </div>
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.workExperienceTotal} />
            <FormField control={control.workExperienceCurrent} />
          </div>
        </div>
      )}

      {/* Секция для самозанятых */}
      {isSelfEmployed && (
        <div className="space-y-4 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold">Информация о бизнесе</h3>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </div>
      )}

      {/* Секция дохода (для работающих и самозанятых) */}
      {(isEmployed || isSelfEmployed) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Доход</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.monthlyIncome} />
            <FormField control={control.additionalIncome} />
          </div>
          <FormField control={control.additionalIncomeSource} />
        </div>
      )}
    </div>
  );
}
