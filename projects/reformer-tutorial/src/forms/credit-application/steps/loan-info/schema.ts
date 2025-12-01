import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LoanInfoStep } from './type';

export const loanInfoSchema: FormSchema<LoanInfoStep> = {
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
        { value: 'business', label: 'Бизнес-кредит' },
        { value: 'refinancing', label: 'Рефинансирование' },
      ],
    },
  },

  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита', type: 'number', min: 50000, max: 10000000 },
  },

  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', min: 6, max: 240 },
  },

  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита', rows: 3 },
  },

  // Поля для ипотеки
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости', type: 'number', min: 1000000 },
  },

  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос', type: 'number', min: 0 },
  },

  // Поля для автокредита
  carBrand: { value: '', component: Input, componentProps: { label: 'Марка автомобиля' } },
  carModel: { value: '', component: Select, componentProps: { label: 'Модель автомобиля' } },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость', type: 'number' },
  },

  // Вычисляемые поля
  interestRate: {
    value: 0,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', disabled: true },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж', disabled: true },
  },
};
