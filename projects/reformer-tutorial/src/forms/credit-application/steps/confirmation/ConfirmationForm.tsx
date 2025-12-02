import type { GroupNodeWithControls } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';
import { FormField } from '@/components/ui/FormField';

interface ConfirmationFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ConfirmationForm({ control }: ConfirmationFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Подтверждение</h2>

      <div className="space-y-4">
        <FormField control={control.agreePersonalData} />
        <FormField control={control.agreeCreditHistory} />
        <FormField control={control.agreeMarketing} />
        <FormField control={control.agreeTerms} />
        <FormField control={control.confirmAccuracy} />
      </div>

      <div className="mt-6">
        <FormField control={control.electronicSignature} />
      </div>
    </div>
  );
}
