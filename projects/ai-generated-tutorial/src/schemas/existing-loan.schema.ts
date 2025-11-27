import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ExistingLoan } from '@/types/credit-application.types';

export const existingLoanSchema: FormSchema<ExistingLoan> = {
  bank: {
    value: '',
    component: Input,
    componentProps: { label: 'Bank', placeholder: 'Bank name' },
  },
  type: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Loan Type',
      options: [
        { value: 'consumer', label: 'Consumer' },
        { value: 'mortgage', label: 'Mortgage' },
        { value: 'car', label: 'Car Loan' },
        { value: 'credit_card', label: 'Credit Card' },
      ],
    },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Loan Amount', type: 'number', min: 0 },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Remaining Amount', type: 'number', min: 0 },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Monthly Payment', type: 'number', min: 0 },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Maturity Date', type: 'date' },
  },
};
