import { computeFrom, enableWhen, watchField, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../../types/credit-application.types';

export const step1LoanBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Computed: Interest Rate
  // ==========================================
  computeFrom([path.loanType, path.hasProperty], path.interestRate, (values) => {
    const baseRates: Record<string, number> = {
      mortgage: 8.5,
      car: 12.0,
      consumer: 15.0,
      business: 18.0,
      refinancing: 14.0,
    };

    let rate = baseRates[values.loanType as string] || 15.0;

    if (values.hasProperty) {
      rate -= 1.0;
    }

    return Math.max(rate, 5.0);
  });

  // ==========================================
  // Computed: Monthly Payment (Annuity Formula)
  // ==========================================
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const termMonths = values.loanTerm as number;
      const annualRate = values.interestRate as number;

      if (!amount || !termMonths || !annualRate) return 0;
      if (amount <= 0 || termMonths <= 0 || annualRate <= 0) return 0;

      const monthlyRate = annualRate / 100 / 12;
      const factor = Math.pow(1 + monthlyRate, termMonths);
      const payment = (amount * (monthlyRate * factor)) / (factor - 1);

      return Math.round(payment);
    }
  );

  // Disable computed fields (read-only)
  disableWhen(path.interestRate, () => true);
  disableWhen(path.monthlyPayment, () => true);

  // ==========================================
  // Conditional Visibility: Mortgage Fields
  // ==========================================
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage');
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage');

  // ==========================================
  // Conditional Visibility: Car Loan Fields
  // ==========================================
  enableWhen(path.carBrand, (form) => form.loanType === 'car');
  enableWhen(path.carModel, (form) => form.loanType === 'car');
  enableWhen(path.carYear, (form) => form.loanType === 'car');
  enableWhen(path.carPrice, (form) => form.loanType === 'car');

  // ==========================================
  // Watch: Reset Fields When Loan Type Changes
  // ==========================================
  watchField(path.loanType, (value, ctx) => {
    if (value !== 'mortgage') {
      // Use direct proxy access
      ctx.form.propertyValue.setValue(0, { emitEvent: false });
      ctx.form.initialPayment.setValue(0, { emitEvent: false });
    }

    if (value !== 'car') {
      ctx.form.carBrand.setValue('', { emitEvent: false });
      ctx.form.carModel.setValue('', { emitEvent: false });
      ctx.form.carYear.setValue(0, { emitEvent: false });
      ctx.form.carPrice.setValue(0, { emitEvent: false });
    }
  });
};
