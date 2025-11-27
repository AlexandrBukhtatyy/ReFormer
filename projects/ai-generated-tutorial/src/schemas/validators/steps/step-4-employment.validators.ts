import { required, min, max, pattern, applyWhen, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';

export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Employment Status - Always Required
  // ==========================================
  required(path.employmentStatus, { message: 'Please select employment status' });

  // ==========================================
  // Employment Fields (when employed)
  // ==========================================
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (p) => {
      required(p.companyName, { message: 'Company name is required' });
      required(p.companyInn, { message: 'Company INN is required' });
      pattern(p.companyInn, /^\d{10}$/, { message: 'Company INN must be 10 digits' });

      required(p.companyPhone, { message: 'Company phone is required' });
      pattern(p.companyPhone, /^\+7\d{10}$/, {
        message: 'Phone must be in format +7XXXXXXXXXX'
      });

      required(p.companyAddress, { message: 'Company address is required' });
      required(p.position, { message: 'Position is required' });

      required(p.workExperienceTotal, { message: 'Total work experience is required' });
      min(p.workExperienceTotal, 0, { message: 'Work experience cannot be negative' });

      required(p.workExperienceCurrent, { message: 'Current job experience is required' });
      min(p.workExperienceCurrent, 0, { message: 'Work experience cannot be negative' });
    }
  );

  // Cross-field: current experience cannot exceed total
  validate(path.workExperienceCurrent, (value, ctx) => {
    const status = ctx.form.employmentStatus.value.value;
    if (status !== 'employed') return null;

    const current = value as number;
    const total = ctx.form.workExperienceTotal.value.value as number;

    if (current > total) {
      return {
        code: 'currentExceedsTotal',
        message: 'Current job experience cannot exceed total experience',
      };
    }
    return null;
  });

  // ==========================================
  // Self-Employed Fields
  // ==========================================
  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Business type is required' });
      required(p.businessInn, { message: 'Business INN is required' });
      pattern(p.businessInn, /^(\d{10}|\d{12})$/, {
        message: 'Business INN must be 10 or 12 digits'
      });
      required(p.businessActivity, { message: 'Business activity description is required' });
    }
  );

  // ==========================================
  // Income Fields - Required for employed/self-employed
  // ==========================================
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed' || status === 'selfEmployed',
    (p) => {
      required(p.monthlyIncome, { message: 'Monthly income is required' });
      min(p.monthlyIncome, 10000, { message: 'Minimum monthly income is 10,000' });
      max(p.monthlyIncome, 100000000, { message: 'Please enter a valid income' });
    }
  );

  // Additional income validation (optional but must be positive)
  validate(path.additionalIncome, (value) => {
    const income = value as number;
    if (income && income < 0) {
      return { code: 'negativeIncome', message: 'Additional income cannot be negative' };
    }
    return null;
  });

  // Additional income source required if additional income provided
  validate(path.additionalIncomeSource, (value, ctx) => {
    const additionalIncome = ctx.form.additionalIncome.value.value as number;
    if (additionalIncome > 0 && !value) {
      return {
        code: 'sourceRequired',
        message: 'Please describe the source of additional income',
      };
    }
    return null;
  });

  // ==========================================
  // Payment to Income Ratio Validation
  // ==========================================
  validate(path.monthlyIncome, (value, ctx) => {
    const income = value as number;
    const monthlyPayment = ctx.form.monthlyPayment.value.value as number;

    if (income > 0 && monthlyPayment > 0) {
      const ratio = monthlyPayment / income;
      if (ratio > 0.5) {
        return {
          code: 'highPaymentRatio',
          message: 'Monthly payment should not exceed 50% of income',
        };
      }
    }
    return null;
  });
};
