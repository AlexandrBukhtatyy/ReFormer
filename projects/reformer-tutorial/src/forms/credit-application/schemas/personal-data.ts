import { Input } from '@/components/ui/input';
import { RadioGroup } from '@/components/ui/radio-group';
import type { FormSchema } from 'reformer';

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: 'male' | 'female';
}

export const personalDataSchema: FormSchema<PersonalData> = {
  lastName: {
    value: '',
    component: Input,
    componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
  },
  firstName: {
    value: '',
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Введите имя' },
  },
  middleName: {
    value: '',
    component: Input,
    componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
  },
  birthDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата рождения', type: 'date' },
  },
  birthPlace: {
    value: '',
    component: Input,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
  },
  gender: {
    value: 'male',
    component: RadioGroup,
    componentProps: {
      label: 'Пол',
      options: [
        { value: 'male', label: 'Мужской' },
        { value: 'female', label: 'Женский' },
      ],
    },
  },
};
