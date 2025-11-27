import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import type { Address } from '../types/credit-application.types';

export const addressSchema: FormSchema<Address> = {
  region: {
    value: '',
    component: Input,
    componentProps: { label: 'Region', placeholder: 'Enter region' },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'City', placeholder: 'Enter city' },
  },
  street: {
    value: '',
    component: Input,
    componentProps: { label: 'Street', placeholder: 'Enter street' },
  },
  house: {
    value: '',
    component: Input,
    componentProps: { label: 'House', placeholder: 'House number' },
  },
  apartment: {
    value: '',
    component: Input,
    componentProps: { label: 'Apartment', placeholder: 'Apt number' },
  },
  postalCode: {
    value: '',
    component: Input,
    componentProps: { label: 'Postal Code', placeholder: '000000' },
  },
};
