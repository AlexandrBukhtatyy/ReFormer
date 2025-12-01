import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { personalDataSchema } from '../../sub-forms/personal-data/schema';
import { passportDataSchema } from '../../sub-forms/passport-data/schema';
import type { PersonalInfoStep } from './type';

export const personalInfoSchema: FormSchema<PersonalInfoStep> = {
  personalData: personalDataSchema,
  passportData: passportDataSchema,

  inn: { value: '', component: Input, componentProps: { label: 'ИНН' } },
  snils: { value: '', component: Input, componentProps: { label: 'СНИЛС' } },

  // Вычисляемые поля
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', disabled: true },
  },
  age: { value: null, component: Input, componentProps: { label: 'Возраст', disabled: true } },
};
