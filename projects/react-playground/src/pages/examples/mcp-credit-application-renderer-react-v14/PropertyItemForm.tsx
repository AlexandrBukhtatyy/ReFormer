import type { FC } from 'react';
import type { FormProxy } from '@reformer/core';
import { FormField, Section } from '@reformer/ui-kit';
import type { PropertyItem } from './schema';

export const PropertyItemForm: FC<{ control: FormProxy<PropertyItem> }> = ({ control }) => (
  <Section className="space-y-3">
    <FormField control={control.type} testId="property-type" />
    <FormField control={control.description} testId="property-description" />
    <FormField control={control.estimatedValue} testId="property-estimatedValue" />
  </Section>
);
