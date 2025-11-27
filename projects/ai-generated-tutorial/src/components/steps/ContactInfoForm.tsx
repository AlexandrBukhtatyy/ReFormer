import type { GroupNodeWithControls } from 'reformer';
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { AddressForm } from '@/components/nested-forms/AddressForm';
import type { CreditApplicationForm } from '@/types/credit-application.types';

interface ContactInfoFormProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Contact Information</h2>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Phone Numbers</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.phoneMain} testId="phoneMain" />
          <FormField control={control.phoneAdditional} testId="phoneAdditional" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Email</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.email} testId="email" />
          <FormField control={control.emailAdditional} testId="emailAdditional" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Registration Address</h3>
        <AddressForm control={control.registrationAddress} testIdPrefix="registrationAddress" />
      </div>

      <FormField control={control.sameAsRegistration} testId="sameAsRegistration" />

      {!sameAsRegistration && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold">Residence Address</h3>
          <AddressForm control={control.residenceAddress} testIdPrefix="residenceAddress" />
        </div>
      )}
    </div>
  );
}
