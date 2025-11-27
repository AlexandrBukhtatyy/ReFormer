import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { CoBorrower } from '@/types/credit-application.types';

export const coBorrowerSchema: FormSchema<CoBorrower> = {
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Last Name' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'First Name' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Middle Name' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Birth Date', type: 'date' },
    },
  },
  phone: {
    value: '',
    component: Input,
    componentProps: { label: 'Phone', placeholder: '+7 (000) 000-00-00' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
  relationship: {
    value: 'spouse',
    component: Select,
    componentProps: {
      label: 'Relationship',
      options: [
        { value: 'spouse', label: 'Spouse' },
        { value: 'parent', label: 'Parent' },
        { value: 'child', label: 'Child' },
        { value: 'sibling', label: 'Sibling' },
        { value: 'other', label: 'Other' },
      ],
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Monthly Income', type: 'number', min: 0 },
  },
};
