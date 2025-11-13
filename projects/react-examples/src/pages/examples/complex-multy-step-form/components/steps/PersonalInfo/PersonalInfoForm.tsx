/**
 * PersonalInfoForm (Step 2)
 *
 * Демонстрирует переиспользование вложенных форм:
 * - PersonalDataForm (личные данные)
 * - PassportDataForm (паспортные данные)
 */

import type { GroupNodeWithControls } from '@/lib/forms';
import { FormField } from '@/lib/forms/components';
import { PersonalDataForm } from '../../nested-forms/PersonalData/PersonalDataForm';
import { PassportDataForm } from '../../nested-forms/PassportData/PassportDataForm';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface PersonalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function PersonalInfoForm({ control }: PersonalInfoFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Персональные данные</h2>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Личные данные</h3>
        <PersonalDataForm control={control.personalData} />
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Паспортные данные</h3>
        <PassportDataForm control={control.passportData} />
      </div>
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
