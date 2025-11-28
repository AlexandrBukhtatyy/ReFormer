import type { GroupNodeWithControls } from 'reformer';
import { useFormControlValue } from 'reformer';
import type { CreditApplicationForm } from '../types/credit-application.types';
import { FormField } from '@/components/ui/FormField';

// TODO: Реализуем на следующем этапе документации
import { PropertyForm } from '../sub-forms/PropertyForm';
import { ExistingLoanForm } from '../sub-forms/ExistingLoanForm';
import { CoBorrowerForm } from '../sub-forms/CoBorrowerForm';
import { FormArrayManager } from '@/components/ui/FormArrayManager';

interface AdditionalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  // Подписываемся ТОЛЬКО на значения для условного рендеринга
  const hasProperty = useFormControlValue(control.hasProperty);
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Дополнительная информация</h2>

      {/* Общая информация */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Общие сведения</h3>
        <FormField control={control.maritalStatus} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.dependents} />
          <FormField control={control.education} />
        </div>
      </div>

      {/* Массив имущества */}
      <div className="space-y-4">
        <FormField control={control.hasProperty} />
        {hasProperty && (
          <FormArrayManager
            itemLabel="Имущество"
            control={control.properties}
            component={PropertyForm}
            addButtonLabel="+ Добавить имущество"
          />
        )}
      </div>

      {/* Массив существующих кредитов */}
      <div className="space-y-4">
        <FormField control={control.hasExistingLoans} />
        {hasExistingLoans && (
          <FormArrayManager
            itemLabel="Существующие кредиты"
            control={control.existingLoans}
            component={ExistingLoanForm}
            addButtonLabel="+ Добавить кредит"
          />
        )}
      </div>

      {/* Массив созаёмщиков */}
      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />
        {hasCoBorrower && (
          <FormArrayManager
            itemLabel="Созаёмщики"
            control={control.coBorrowers}
            component={CoBorrowerForm}
            addButtonLabel="+ Добавить созаёмщика"
          />
        )}
      </div>
    </div>
  );
}
