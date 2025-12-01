import { memo } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/FormField';
import type { Property } from './type';

interface PropertyFormProps {
  control: GroupNodeWithControls<Property>;
}

const PropertyFormComponent = ({ control }: PropertyFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.type} />
        <FormField control={control.estimatedValue} />
      </div>

      <FormField control={control.description} />

      <FormField control={control.hasEncumbrance} />
    </div>
  );
};

export const PropertyForm = memo(PropertyFormComponent);
