import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';

export const blankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: 'consumer',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});
