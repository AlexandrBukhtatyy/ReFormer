import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '@/components/ui/radio-group';
import type { PersonalData } from '../types/credit-application.types';

export const personalDataSchema: FormSchema<PersonalData> = {
  lastName: {
    value: '',
    component: Input,
    componentProps: { label: 'Last Name', placeholder: 'Enter last name' },
  },
  firstName: {
    value: '',
    component: Input,
    componentProps: { label: 'First Name', placeholder: 'Enter first name' },
  },
  middleName: {
    value: '',
    component: Input,
    componentProps: { label: 'Middle Name', placeholder: 'Enter middle name' },
  },
  birthDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Birth Date', type: 'date' },
  },
  birthPlace: {
    value: '',
    component: Input,
    componentProps: { label: 'Birth Place', placeholder: 'Enter birth place' },
  },
  gender: {
    value: 'male',
    component: RadioGroup,
    componentProps: {
      label: 'Gender',
      options: [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
      ],
    },
  },
};
