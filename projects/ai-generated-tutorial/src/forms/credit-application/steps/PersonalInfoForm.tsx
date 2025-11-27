import { FormField } from '@/components/ui/form-field';
import { PersonalDataForm } from '../sub-forms/PersonalDataForm';
import { PassportDataForm } from '../sub-forms/PassportDataForm';
import type { CreditApplicationForm } from '../types/credit-application.types';
import type { GroupNodeWithControls } from 'reformer';

interface PersonalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function PersonalInfoForm({ control }: PersonalInfoFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Personal Information</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Personal Data</h3>
        <PersonalDataForm control={control.personalData} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Passport Data</h3>
        <PassportDataForm control={control.passportData} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Documents</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.inn} testId="inn" />
          <FormField control={control.snils} testId="snils" />
        </div>
      </div>
    </div>
  );
}
