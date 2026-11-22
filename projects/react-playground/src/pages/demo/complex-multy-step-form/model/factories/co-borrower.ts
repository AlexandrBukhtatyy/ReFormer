import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';

export const blankCoBorrower = (): CoBorrower => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
  },
  phone: '',
  email: '',
  relationship: 'spouse',
  monthlyIncome: 0,
});
