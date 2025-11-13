/**
 * AdditionalInfoForm (Step 5)
 *
 * Демонстрирует работу с массивами форм через готовые компоненты:
 * - PropertyForm (имущество)
 * - ExistingLoanForm (кредиты)
 * - CoBorrowerForm (созаемщики с вложенной personalData)
 *
 * NOTE: Массивы будут активированы после раскомментирования в схеме
 */

import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { PropertyForm } from '../../nested-forms/Property/PropertyForm';
import { ExistingLoanForm } from '../../nested-forms/ExistingLoan/ExistingLoanForm';
import { CoBorrowerForm } from '../../nested-forms/CoBorrower/CoBorrowerForm';
import { FormArraySection } from '../../FormArraySection';
import type { CreditApplicationForm } from '../../../types/credit-application';

interface AdditionalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const hasProperty = control.hasProperty.value.value;
  const hasExistingLoans = control.hasExistingLoans.value.value;
  const hasCoBorrower = control.hasCoBorrower.value.value;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Дополнительная информация</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Общая информация</h3>

        <FormField control={control.maritalStatus} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.dependents} />
          <FormField control={control.education} />
        </div>
      </div>

      <div className="space-y-4">
        <FormField control={control.hasProperty} />

        <FormArraySection
          title="Имущество"
          control={control.properties}
          itemComponent={PropertyForm}
          itemLabel="Имущество"
          addButtonLabel="+ Добавить имущество"
          emptyMessage='Нажмите "Добавить имущество" для добавления информации'
          hasItems={hasProperty}
        />
      </div>

      <div className="space-y-4">
        <FormField control={control.hasExistingLoans} />

        <FormArraySection
          title="Существующие кредиты"
          control={control.existingLoans}
          itemComponent={ExistingLoanForm}
          itemLabel="Кредит"
          addButtonLabel="+ Добавить кредит"
          emptyMessage='Нажмите "Добавить кредит" для добавления информации'
          hasItems={hasExistingLoans}
        />
      </div>

      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />

        <FormArraySection
          title="Созаемщики"
          control={control.coBorrowers}
          itemComponent={CoBorrowerForm}
          itemLabel="Созаемщик"
          addButtonLabel="+ Добавить созаемщика"
          emptyMessage='Нажмите "Добавить созаемщика" для добавления информации'
          emptyMessageHint="CoBorrowerForm поддерживает вложенную группу personalData"
          hasItems={hasCoBorrower}
        />
      </div>
    </div>
  );
}
