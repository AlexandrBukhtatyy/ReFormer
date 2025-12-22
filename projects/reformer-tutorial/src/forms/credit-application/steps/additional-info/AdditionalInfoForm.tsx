import type { FormProxy } from '@reformer/core';
import { useFormControlValue } from '@reformer/core';
import { FormArray } from '@reformer/ui/form-array';
import type { CreditApplicationForm } from '../../type';
import { FormField } from '@/components/ui/FormField';
import { PropertyForm } from '../../sub-forms/property/PropertyForm';
import { ExistingLoanForm } from '../../sub-forms/existing-loan/ExistingLoanForm';
import { CoBorrowerForm } from '../../sub-forms/co-borrower/CoBorrowerForm';
import { Button } from '@/components/ui/button';

interface AdditionalInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
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
          <FormArray.Root control={control.properties}>
            <div className="flex justify-between items-center">
              <FormArray.Count
                render={(count) => (
                  <span className="text-sm text-muted-foreground">{count} Имущество</span>
                )}
              />
              <FormArray.AddButton asChild>
                <Button type="button" variant="outline" size="sm">
                  + Добавить имущество
                </Button>
              </FormArray.AddButton>
            </div>

            <FormArray.List>
              {({ control: itemControl, index, remove }) => (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-900">Имущество #{index + 1}</h4>
                    <Button type="button" variant="destructive" size="sm" onClick={remove}>
                      Удалить
                    </Button>
                  </div>
                  <PropertyForm control={itemControl} />
                </div>
              )}
            </FormArray.List>

            <FormArray.Empty>
              <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                Нет имущества. Нажмите кнопку выше, чтобы добавить.
              </div>
            </FormArray.Empty>
          </FormArray.Root>
        )}
      </div>

      {/* Массив существующих кредитов */}
      <div className="space-y-4">
        <FormField control={control.hasExistingLoans} />
        {hasExistingLoans && (
          <FormArray.Root control={control.existingLoans}>
            <div className="flex justify-between items-center">
              <FormArray.Count
                render={(count) => (
                  <span className="text-sm text-muted-foreground">
                    {count} Существующие кредиты
                  </span>
                )}
              />
              <FormArray.AddButton asChild>
                <Button type="button" variant="outline" size="sm">
                  + Добавить кредит
                </Button>
              </FormArray.AddButton>
            </div>

            <FormArray.List>
              {({ control: itemControl, index, remove }) => (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-900">Кредит #{index + 1}</h4>
                    <Button type="button" variant="destructive" size="sm" onClick={remove}>
                      Удалить
                    </Button>
                  </div>
                  <ExistingLoanForm control={itemControl} />
                </div>
              )}
            </FormArray.List>

            <FormArray.Empty>
              <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                Нет кредитов. Нажмите кнопку выше, чтобы добавить.
              </div>
            </FormArray.Empty>
          </FormArray.Root>
        )}
      </div>

      {/* Массив созаёмщиков */}
      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />
        {hasCoBorrower && (
          <FormArray.Root control={control.coBorrowers}>
            <div className="flex justify-between items-center">
              <FormArray.Count
                render={(count) => (
                  <span className="text-sm text-muted-foreground">{count} Созаёмщики</span>
                )}
              />
              <FormArray.AddButton asChild>
                <Button type="button" variant="outline" size="sm">
                  + Добавить созаёмщика
                </Button>
              </FormArray.AddButton>
            </div>

            <FormArray.List>
              {({ control: itemControl, index, remove }) => (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-900">Созаёмщик #{index + 1}</h4>
                    <Button type="button" variant="destructive" size="sm" onClick={remove}>
                      Удалить
                    </Button>
                  </div>
                  <CoBorrowerForm control={itemControl} />
                </div>
              )}
            </FormArray.List>

            <FormArray.Empty>
              <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                Нет созаёмщиков. Нажмите кнопку выше, чтобы добавить.
              </div>
            </FormArray.Empty>
          </FormArray.Root>
        )}
      </div>
    </div>
  );
}
