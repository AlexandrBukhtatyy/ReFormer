import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { FormSchema } from 'reformer';

export interface CoBorrower {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

export const coBorrowerSchema: FormSchema<CoBorrower> = {
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date' },
    },
  },
  phone: {
    value: '',
    component: Input,
    componentProps: { label: 'Телефон', placeholder: '+7 (000) 000-00-00' },
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
      label: 'Родственная связь',
      options: [
        { value: 'spouse', label: 'Супруг/Супруга' },
        { value: 'parent', label: 'Родитель' },
        { value: 'child', label: 'Ребёнок' },
        { value: 'sibling', label: 'Брат/Сестра' },
        { value: 'other', label: 'Другое' },
      ],
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный доход', type: 'number', min: 0 },
  },
};
