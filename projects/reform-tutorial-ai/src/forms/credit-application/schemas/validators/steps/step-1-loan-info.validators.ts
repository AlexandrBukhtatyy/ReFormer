import { required, min, max, applyWhen, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../../types/credit-application.types';

export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Basic Loan Fields - Always Required
  // ==========================================
  required(path.loanType, { message: 'Please select a loan type' });
  required(path.loanAmount, { message: 'Please enter the loan amount' });
  min(path.loanAmount, 10000, { message: 'Minimum loan amount is 10,000' });
  max(path.loanAmount, 50000000, { message: 'Maximum loan amount is 50,000,000' });

  required(path.loanTerm, { message: 'Please select loan term' });
  min(path.loanTerm, 6, { message: 'Minimum loan term is 6 months' });
  max(path.loanTerm, 360, { message: 'Maximum loan term is 360 months' });

  required(path.loanPurpose, { message: 'Please describe the loan purpose' });

  // ==========================================
  // Mortgage-Specific Validation
  // ==========================================
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Please enter property value' });
      min(p.propertyValue, 500000, { message: 'Minimum property value is 500,000' });

      required(p.initialPayment, { message: 'Please enter initial payment' });
      min(p.initialPayment, 0, { message: 'Initial payment cannot be negative' });
    }
  );

  // ==========================================
  // Car Loan-Specific Validation
  // ==========================================
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (p) => {
      required(p.carBrand, { message: 'Please enter car brand' });
      required(p.carModel, { message: 'Please enter car model' });
      required(p.carYear, { message: 'Please enter car year' });

      validate(p.carYear, (value) => {
        const year = value as number;
        const currentYear = new Date().getFullYear();
        if (year < 2000 || year > currentYear + 1) {
          return {
            code: 'invalidYear',
            message: `Year must be between 2000 and ${currentYear + 1}`,
          };
        }
        return null;
      });

      required(p.carPrice, { message: 'Please enter car price' });
      min(p.carPrice, 100000, { message: 'Minimum car price is 100,000' });
    }
  );

  // ==========================================
  // Cross-Field Validation: Initial Payment <= Property Value
  // ==========================================
  validate(path.initialPayment, (value, ctx) => {
    const loanType = ctx.form.loanType.value.value;
    if (loanType !== 'mortgage') return null;

    const initialPayment = value as number;
    const propertyValue = ctx.form.propertyValue.value.value as number;

    if (initialPayment && propertyValue && initialPayment > propertyValue) {
      return {
        code: 'initialPaymentTooHigh',
        message: 'Initial payment cannot exceed property value',
      };
    }
    return null;
  });

  // ==========================================
  // Cross-Field Validation: Minimum Down Payment 10%
  // ==========================================
  validate(path.initialPayment, (value, ctx) => {
    const loanType = ctx.form.loanType.value.value;
    if (loanType !== 'mortgage') return null;

    const initialPayment = value as number;
    const propertyValue = ctx.form.propertyValue.value.value as number;

    if (initialPayment && propertyValue) {
      const minDownPayment = propertyValue * 0.1;
      if (initialPayment < minDownPayment) {
        return {
          code: 'downPaymentTooLow',
          message: 'Initial payment must be at least 10% of property value',
        };
      }
    }
    return null;
  });
};
