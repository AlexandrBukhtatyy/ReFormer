import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Property } from '../types/credit-application.types';

export const propertySchema: FormSchema<Property> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Property Type',
      options: [
        { value: 'apartment', label: 'Apartment' },
        { value: 'house', label: 'House' },
        { value: 'land', label: 'Land' },
        { value: 'commercial', label: 'Commercial' },
        { value: 'car', label: 'Car' },
        { value: 'other', label: 'Other' },
      ],
    },
  },
  description: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Description', placeholder: 'Describe the property', rows: 2 },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: { label: 'Estimated Value', type: 'number', min: 0 },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Has encumbrance (mortgage, lien)' },
  },
};
