import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { FormSchema } from 'reformer';
import type { ExistingLoan } from './type';

export const existingLoanSchema: FormSchema<ExistingLoan> = {
  bank: {
    value: '',
    component: Input,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
        { value: 'credit_card', label: 'Кредитная карта' },
      ],
    },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Сумма кредита', type: 'number', min: 0 },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Остаток долга', type: 'number', min: 0 },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж', type: 'number', min: 0 },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
};
