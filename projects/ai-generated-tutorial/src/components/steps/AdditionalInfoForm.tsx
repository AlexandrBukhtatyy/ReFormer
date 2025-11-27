import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { FormArrayManager } from '@/components/FormArrayManager';
import { PropertyForm } from '@/components/nested-forms/PropertyForm';
import { ExistingLoanForm } from '@/components/nested-forms/ExistingLoanForm';
import { CoBorrowerForm } from '@/components/nested-forms/CoBorrowerForm';
import type { CreditApplicationForm } from '@/types/credit-application.types';

interface AdditionalInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasExistingLoans } = useFormControl(control.hasExistingLoans);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Additional Information</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">General</h3>
        <FormField control={control.maritalStatus} testId="maritalStatus" />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.dependents} testId="dependents" />
          <FormField control={control.education} testId="education" />
        </div>
      </div>

      <div className="space-y-4">
        <FormField control={control.hasProperty} testId="hasProperty" />
        {hasProperty && (
          <FormArrayManager
            control={control.properties}
            component={PropertyForm}
            itemLabel="Property"
            addButtonLabel="+ Add Property"
            emptyMessage="Click the button above to add property"
          />
        )}
      </div>

      <div className="space-y-4">
        <FormField control={control.hasExistingLoans} testId="hasExistingLoans" />
        {hasExistingLoans && (
          <FormArrayManager
            control={control.existingLoans}
            component={ExistingLoanForm}
            itemLabel="Loan"
            addButtonLabel="+ Add Existing Loan"
            emptyMessage="Click the button above to add existing loan"
          />
        )}
      </div>

      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} testId="hasCoBorrower" />
        {hasCoBorrower && (
          <FormArrayManager
            control={control.coBorrowers}
            component={CoBorrowerForm}
            itemLabel="Co-Borrower"
            addButtonLabel="+ Add Co-Borrower"
            emptyMessage="Click the button above to add co-borrower"
          />
        )}
      </div>
    </div>
  );
}
