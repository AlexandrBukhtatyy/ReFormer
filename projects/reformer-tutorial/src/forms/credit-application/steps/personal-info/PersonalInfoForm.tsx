import type { GroupNodeWithControls } from 'reformer';
import type { CreditApplicationForm } from '../../type';
import { FormField } from '@/components/ui/FormField';
import { PersonalDataForm } from '../../sub-forms/personal-data/PersonalDataForm';
import { PassportDataForm } from '../../sub-forms/passport-data/PassportDataForm';
import { memo } from 'react';

interface PersonalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function PersonalInfoFormComponent({ control }: PersonalInfoFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Персональные данные</h2>

      {/* Вложенная форма: Личные данные */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Личные данные</h3>
        <PersonalDataForm control={control.personalData} />
      </div>

      {/* Вложенная форма: Паспортные данные */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Паспортные данные</h3>
        <PassportDataForm control={control.passportData} />
      </div>

      {/* Дополнительные документы */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Дополнительные документы</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.inn} />
          <FormField control={control.snils} />
        </div>
      </div>
    </div>
  );
}

export const PersonalInfoForm = memo(PersonalInfoFormComponent);
