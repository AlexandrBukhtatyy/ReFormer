import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types/credit-application.types';

interface ConfirmationFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ConfirmationForm({ control }: ConfirmationFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Confirmation</h2>

      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-4">
          Please review and confirm the following agreements:
        </p>

        <FormField control={control.agreePersonalData} testId="agreePersonalData" />
        <FormField control={control.agreeCreditHistory} testId="agreeCreditHistory" />
        <FormField control={control.agreeMarketing} testId="agreeMarketing" />
        <FormField control={control.agreeTerms} testId="agreeTerms" />
        <FormField control={control.confirmAccuracy} testId="confirmAccuracy" />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Electronic Signature</h3>
        <p className="text-sm text-gray-600">
          Enter the confirmation code sent to your phone to sign the application electronically.
        </p>
        <FormField control={control.electronicSignature} testId="electronicSignature" />
      </div>
    </div>
  );
}
