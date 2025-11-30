import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types/credit-application.types';

interface EmploymentFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function EmploymentForm({ control }: EmploymentFormProps) {
  const { value: employmentStatus } = useFormControl(control.employmentStatus);
  const statusValue = employmentStatus as unknown as string;

  const isEmployed = statusValue === 'employed';
  const isSelfEmployed = statusValue === 'selfEmployed';

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Employment Information</h2>

      <FormField control={control.employmentStatus} testId="employmentStatus" />

      {isEmployed && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold">Company Information</h3>
          <FormField control={control.companyName} testId="companyName" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.companyInn} testId="companyInn" />
            <FormField control={control.companyPhone} testId="companyPhone" />
          </div>
          <FormField control={control.companyAddress} testId="companyAddress" />
          <FormField control={control.position} testId="position" />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.workExperienceTotal} testId="workExperienceTotal" />
            <FormField control={control.workExperienceCurrent} testId="workExperienceCurrent" />
          </div>
        </div>
      )}

      {isSelfEmployed && (
        <div className="space-y-4 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold">Business Information</h3>
          <FormField control={control.businessType} testId="businessType" />
          <FormField control={control.businessInn} testId="businessInn" />
          <FormField control={control.businessActivity} testId="businessActivity" />
        </div>
      )}

      {(isEmployed || isSelfEmployed) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Income</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.monthlyIncome} testId="monthlyIncome" />
            <FormField control={control.additionalIncome} testId="additionalIncome" />
          </div>
          <FormField control={control.additionalIncomeSource} testId="additionalIncomeSource" />
        </div>
      )}
    </div>
  );
}
