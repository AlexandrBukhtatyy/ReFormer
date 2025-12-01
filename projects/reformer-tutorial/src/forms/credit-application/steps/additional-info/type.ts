import type { Property } from '../../sub-forms/property/type';
import type { ExistingLoan } from '../../sub-forms/existing-loan/type';
import type { CoBorrower } from '../../sub-forms/co-borrower/type';

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

export interface AdditionalInfoStep {
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;

  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Вычисляемое поле
  coBorrowersIncome: number;
}
