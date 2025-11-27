import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { Address } from '.../types/credit-application.types';

interface AddressFormProps {
  control: GroupNodeWithControls<Address>;
  testIdPrefix?: string;
}

const AddressFormComponent = ({ control, testIdPrefix = 'address' }: AddressFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.region} testId={`${testIdPrefix}-region`} />
        <FormField control={control.city} testId={`${testIdPrefix}-city`} />
      </div>

      <FormField control={control.street} testId={`${testIdPrefix}-street`} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.house} testId={`${testIdPrefix}-house`} />
        <FormField control={control.apartment} testId={`${testIdPrefix}-apartment`} />
        <FormField control={control.postalCode} testId={`${testIdPrefix}-postalCode`} />
      </div>
    </div>
  );
};

export const AddressForm = memo(AddressFormComponent);
