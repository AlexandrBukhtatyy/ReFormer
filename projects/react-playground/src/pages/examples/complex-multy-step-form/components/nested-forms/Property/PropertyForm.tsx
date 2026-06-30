import { FormField } from '@reformer/ui-kit';
import { memo } from 'react';
import type { FormProxy } from '@reformer/core';
import type { Property } from './types';

export type { Property, PropertyType } from './types';

interface PropertyFormProps {
  // GroupProxy для элемента массива properties
  control: FormProxy<Property>;
}

const PropertyFormComponent = ({ control }: PropertyFormProps) => {
  return (
    <div className="space-y-3">
      <FormField control={control.type} testId="property-type" />
      <FormField control={control.description} testId="property-description" />
      <FormField control={control.estimatedValue} testId="property-estimatedValue" />
      <FormField control={control.hasEncumbrance} testId="property-hasEncumbrance" />
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const PropertyForm = memo(PropertyFormComponent);
