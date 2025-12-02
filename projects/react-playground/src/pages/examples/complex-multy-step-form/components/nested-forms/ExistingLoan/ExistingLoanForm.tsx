import { memo } from 'react';
import { EXISTING_LOAN_TYPES } from '../../../constants/credit-application';
import type { FormSchema, GroupNodeWithControls } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';

export interface ExistingLoan {
  id?: string;
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

export const existingLoansFormSchema: FormSchema<ExistingLoan> = {
  bank: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Банк',
      placeholder: 'Название банка',
    },
  },
  type: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип',
      options: EXISTING_LOAN_TYPES,
    },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Остаток долга (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 100,
    },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дата погашения',
      type: 'date',
    },
  },
};

interface ExistingLoanFormProps {
  control: GroupNodeWithControls<ExistingLoan>;
}

const ExistingLoanFormComponent = ({ control }: ExistingLoanFormProps) => {
  return (
    <div className="space-y-3">
      <FormField control={control.bank} testId="existingLoan-bank" />
      <FormField control={control.type} testId="existingLoan-type" />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.amount} testId="existingLoan-amount" />
        <FormField control={control.remainingAmount} testId="existingLoan-remainingAmount" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.monthlyPayment} testId="existingLoan-monthlyPayment" />
        <FormField control={control.maturityDate} testId="existingLoan-maturityDate" />
      </div>
    </div>
  );
};

// Мемоизируем компонент, чтобы предотвратить ререндер при изменении других полей
export const ExistingLoanForm = memo(ExistingLoanFormComponent);
