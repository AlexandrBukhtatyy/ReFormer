import { enableWhen, computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm, CoBorrower } from '../../../types/credit-application.types';

export const step5AdditionalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Show Properties Array When hasProperty === true
  // ==========================================
  enableWhen(path.properties, (form) => form.hasProperty === true);

  // ==========================================
  // Show Existing Loans Array When hasExistingLoans === true
  // ==========================================
  enableWhen(path.existingLoans, (form) => form.hasExistingLoans === true);

  // ==========================================
  // Show Co-Borrowers Array When hasCoBorrower === true
  // ==========================================
  enableWhen(path.coBorrowers, (form) => form.hasCoBorrower === true);

  // ==========================================
  // Computed: Total Co-Borrowers Income
  // ==========================================
  computeFrom([path.coBorrowers], path.coBorrowersIncome, (values) => {
    const coBorrowers = (values.coBorrowers as CoBorrower[]) || [];
    return coBorrowers.reduce((sum, cb) => sum + (cb.monthlyIncome || 0), 0);
  });

  // Disable coBorrowersIncome (read-only)
  disableWhen(path.coBorrowersIncome, () => true);
};
