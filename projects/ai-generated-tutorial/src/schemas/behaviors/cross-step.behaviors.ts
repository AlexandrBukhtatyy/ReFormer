import { computeFrom, disableWhen, revalidateWhen, watchField } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';

export const crossStepBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Payment-to-Income Ratio
  // ==========================================
  computeFrom(
    [path.monthlyPayment, path.totalIncome, path.coBorrowersIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const payment = values.monthlyPayment as number;
      const mainIncome = values.totalIncome as number;
      const coIncome = values.coBorrowersIncome as number;

      const totalHouseholdIncome = (mainIncome || 0) + (coIncome || 0);
      if (!totalHouseholdIncome || !payment) return 0;

      return Math.round((payment / totalHouseholdIncome) * 100);
    }
  );

  // Disable paymentToIncomeRatio (read-only)
  disableWhen(path.paymentToIncomeRatio, () => true);

  // ==========================================
  // Revalidate Payment When Income Changes
  // ==========================================
  revalidateWhen(path.monthlyPayment, [path.totalIncome, path.coBorrowersIncome]);

  // ==========================================
  // Age-Based Access Control
  // ==========================================
  disableWhen(path.loanAmount, (form) => (form.age ?? 99) < 18);
  disableWhen(path.loanTerm, (form) => (form.age ?? 99) < 18);
  disableWhen(path.loanPurpose, (form) => (form.age ?? 99) < 18);

  // ==========================================
  // Analytics Tracking (console.log for demo)
  // ==========================================
  watchField(path.loanAmount, (value) => {
    console.log('[Analytics] Loan amount changed:', value);
  });

  watchField(path.interestRate, (value) => {
    console.log('[Analytics] Interest rate computed:', value);
  });

  watchField(path.employmentStatus, (value) => {
    console.log('[Analytics] Employment status changed:', value);
  });
};
