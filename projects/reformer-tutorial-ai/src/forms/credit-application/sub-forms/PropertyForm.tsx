import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import type { Property } from '../types/credit-application.types';

interface PropertyFormProps {
  control: GroupNodeWithControls<Property>;
}

const PropertyFormComponent = ({ control }: PropertyFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.type} testId="property-type" />
        <FormField control={control.estimatedValue} testId="property-estimatedValue" />
      </div>

      <FormField control={control.description} testId="property-description" />

      <FormField control={control.hasEncumbrance} testId="property-hasEncumbrance" />
    </div>
  );
};

export const PropertyForm = memo(PropertyFormComponent);
