import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { propertySchema } from '../../sub-forms/property/schema';
import { existingLoanSchema } from '../../sub-forms/existing-loan/schema';
import { coBorrowerSchema } from '../../sub-forms/co-borrower/schema';
import type { AdditionalInfoStep } from './type';

export const additionalInfoSchema: FormSchema<AdditionalInfoStep> = {
  maritalStatus: {
    value: 'single',
    component: Select,
    componentProps: {
      label: 'Семейное положение',
      options: [
        { value: 'single', label: 'Не женат / Не замужем' },
        { value: 'married', label: 'Женат / Замужем' },
        { value: 'divorced', label: 'Разведён / Разведена' },
        { value: 'widowed', label: 'Вдовец / Вдова' },
      ],
    },
  },

  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Иждивенцы', type: 'number' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      options: [
        { value: 'secondary', label: 'Среднее' },
        { value: 'specialized', label: 'Среднее специальное' },
        { value: 'higher', label: 'Высшее' },
        { value: 'postgraduate', label: 'Учёная степень' },
      ],
    },
  },

  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: [propertySchema],

  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть действующие кредиты' },
  },
  existingLoans: [existingLoanSchema],

  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаёмщика' },
  },
  coBorrowers: [coBorrowerSchema],

  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Доход созаёмщиков', disabled: true },
  },
};
