import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { addressSchema } from '../../sub-forms/address/schema';
import type { ContactInfoStep } from './type';

export const contactInfoSchema: FormSchema<ContactInfoStep> = {
  phoneMain: { value: '', component: Input, componentProps: { label: 'Основной телефон' } },
  phoneAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный телефон' },
  },
  email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email' },
  },

  registrationAddress: addressSchema,
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: addressSchema,
};
