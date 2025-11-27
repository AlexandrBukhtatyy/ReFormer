import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { PersonalData } from '@/types/credit-application.types';

interface PersonalDataFormProps {
  control: GroupNodeWithControls<PersonalData>;
}

const PersonalDataFormComponent = ({ control }: PersonalDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.lastName} testId="personal-lastName" />
        <FormField control={control.firstName} testId="personal-firstName" />
        <FormField control={control.middleName} testId="personal-middleName" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.birthDate} testId="personal-birthDate" />
        <FormField control={control.birthPlace} testId="personal-birthPlace" />
      </div>

      <FormField control={control.gender} testId="personal-gender" />
    </div>
  );
};

export const PersonalDataForm = memo(PersonalDataFormComponent);
