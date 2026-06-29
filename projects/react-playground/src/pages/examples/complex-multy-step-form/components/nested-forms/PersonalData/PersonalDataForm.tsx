import { memo } from 'react';
import type { FormProxy } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import type { PersonalData } from './types';

export type { PersonalData } from './types';

interface PersonalDataFormProps {
  // GroupProxy для вложенной формы personalData (используем any для обхода ограничений TypeScript)
  control: FormProxy<PersonalData>;
}

const PersonalDataFormComponent = ({ control }: PersonalDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.lastName} testId="personalData-lastName" />
        <FormField control={control.firstName} testId="personalData-firstName" />
        <FormField control={control.middleName} testId="personalData-middleName" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.birthDate} testId="personalData-birthDate" />
        <FormField control={control.gender} testId="personalData-gender" />
      </div>
      <FormField control={control.birthPlace} testId="personalData-birthPlace" />
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const PersonalDataForm = memo(PersonalDataFormComponent);
