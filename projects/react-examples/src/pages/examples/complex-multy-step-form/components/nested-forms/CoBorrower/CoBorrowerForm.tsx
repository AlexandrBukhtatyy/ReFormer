import { memo } from 'react';
import { FormField } from '@/lib/forms/components/core/form-field';
import { Input, InputMask, Select } from '@/lib/forms/components';
import { RELATIONSHIPS } from '../../../constants/credit-application';
import type { FormSchema, GroupNodeWithControls } from '@/lib/forms';

export interface CoBorrower {
  id?: string;
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

export const coBorrowersFormSchema: FormSchema<CoBorrower> = {
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Фамилия',
        placeholder: 'Введите фамилию',
      },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Имя',
        placeholder: 'Введите имя',
      },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Отчество',
        placeholder: 'Введите отчество',
      },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Дата рождения',
        type: 'date',
      },
    },
  },
  phone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      placeholder: 'example@mail.com',
      type: 'email',
    },
  },
  relationship: {
    value: 'spouse',
    component: Select,
    componentProps: {
      label: 'Отношение к заемщику',
      placeholder: 'Выберите отношение',
      options: RELATIONSHIPS,
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
};

interface CoBorrowerFormProps {
  // GroupProxy для элемента массива coBorrowers
  control: GroupNodeWithControls<CoBorrower>;
}

const CoBorrowerFormComponent = ({ control }: CoBorrowerFormProps) => {

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <FormField control={control.personalData.lastName} />
        <FormField control={control.personalData.firstName} />
        <FormField control={control.personalData.middleName} />
      </div>

      <FormField control={control.personalData.birthDate} />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.phone} />
        <FormField control={control.email} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.relationship} />
        <FormField control={control.monthlyIncome} />
      </div>
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const CoBorrowerForm = memo(CoBorrowerFormComponent);
