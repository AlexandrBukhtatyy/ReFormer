import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { PersonalData } from '../types/credit-application.types';

interface PersonalDataFormProps {
  control: GroupNodeWithControls<PersonalData>;
}

const PersonalDataFormComponent = ({ control }: PersonalDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.lastName} />
        <FormField control={control.firstName} />
        <FormField control={control.middleName} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.birthDate} />
        <FormField control={control.birthPlace} />
      </div>

      <FormField control={control.gender} />
    </div>
  );
};

export const PersonalDataForm = memo(PersonalDataFormComponent);
