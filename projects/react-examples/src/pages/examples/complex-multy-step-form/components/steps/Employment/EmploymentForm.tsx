import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface EmploymentFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function EmploymentForm({ control }: EmploymentFormProps) {
  const employmentStatus = control.employmentStatus.value.value;

  return (
    <div className="space-y-6" data-testid="step-employment">
      <h2 className="text-xl font-bold" data-testid="step-heading">
        Информация о занятости
      </h2>

      <div className="space-y-4">
        <FormField control={control.employmentStatus} testId="employmentStatus" />
      </div>

      {employmentStatus === 'employed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mt-6">Информация о работодателе</h3>
          <FormField control={control.companyName} testId="companyName" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.companyInn} testId="companyInn" />
            <FormField control={control.companyPhone} testId="companyPhone" />
          </div>
          <FormField control={control.companyAddress} testId="companyAddress" />

          <h3 className="text-lg font-semibold mt-6">Должность и стаж</h3>
          <FormField control={control.position} testId="position" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.workExperienceTotal} testId="workExperienceTotal" />
            <FormField control={control.workExperienceCurrent} testId="workExperienceCurrent" />
          </div>
        </div>
      )}

      {employmentStatus === 'selfEmployed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mt-6">Информация о бизнесе</h3>
          <FormField control={control.businessType} testId="businessType" />
          <FormField control={control.businessInn} testId="businessInn" />
          <FormField control={control.businessActivity} testId="businessActivity" />
        </div>
      )}

      {employmentStatus !== 'unemployed' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mt-6">Доход</h3>
          <FormField control={control.monthlyIncome} testId="monthlyIncome" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.additionalIncome} testId="additionalIncome" />
            <FormField control={control.additionalIncomeSource} testId="additionalIncomeSource" />
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
