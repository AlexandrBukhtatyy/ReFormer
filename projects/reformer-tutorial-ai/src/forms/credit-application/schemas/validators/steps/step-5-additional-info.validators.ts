import { required, min, max, applyWhen, notEmpty, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type {
  CreditApplicationForm,
  Property,
  ExistingLoan,
  CoBorrower,
} from '../../../types/credit-application.types';

// Property item validation
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.type, { message: 'Property type is required' });
  required(path.description, { message: 'Description is required' });
  required(path.estimatedValue, { message: 'Estimated value is required' });
  min(path.estimatedValue, 10000, { message: 'Minimum value is 10,000' });
};

// Existing loan item validation
const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
  path: FieldPath<ExistingLoan>
) => {
  required(path.bank, { message: 'Bank name is required' });
  required(path.type, { message: 'Loan type is required' });
  required(path.amount, { message: 'Original amount is required' });
  min(path.amount, 1000, { message: 'Minimum amount is 1,000' });
  required(path.remainingAmount, { message: 'Remaining amount is required' });
  min(path.remainingAmount, 0, { message: 'Remaining amount cannot be negative' });
  required(path.monthlyPayment, { message: 'Monthly payment is required' });
  min(path.monthlyPayment, 100, { message: 'Minimum payment is 100' });
  required(path.maturityDate, { message: 'Maturity date is required' });
};

// Co-borrower item validation
const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.personalData.lastName, { message: 'Last name is required' });
  required(path.personalData.firstName, { message: 'First name is required' });
  required(path.personalData.birthDate, { message: 'Birth date is required' });
  required(path.phone, { message: 'Phone is required' });
  required(path.email, { message: 'Email is required' });
  required(path.relationship, { message: 'Relationship is required' });
  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 0, { message: 'Income cannot be negative' });
};

export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Basic Additional Info
  // ==========================================
  required(path.maritalStatus, { message: 'Marital status is required' });

  required(path.dependents, { message: 'Number of dependents is required' });
  min(path.dependents, 0, { message: 'Dependents cannot be negative' });
  max(path.dependents, 20, { message: 'Please enter a valid number' });

  required(path.education, { message: 'Education level is required' });

  // ==========================================
  // Properties Array Validation
  // ==========================================
  applyWhen(
    path.hasProperty,
    (has) => has === true,
    (p) => {
      notEmpty(p.properties, { message: 'Please add at least one property' });
      // TODO: Apply propertyValidation to each item when validateItems is available
    }
  );

  // ==========================================
  // Existing Loans Array Validation
  // ==========================================
  applyWhen(
    path.hasExistingLoans,
    (has) => has === true,
    (p) => {
      notEmpty(p.existingLoans, { message: 'Please add at least one loan' });
      // TODO: Apply existingLoanValidation to each item
    }
  );

  // Cross-field: remaining amount cannot exceed original
  validate(path.existingLoans, (value) => {
    const loans = value as ExistingLoan[];
    if (!loans || loans.length === 0) return null;

    for (let i = 0; i < loans.length; i++) {
      const loan = loans[i];
      if (loan.remainingAmount > loan.amount) {
        return {
          code: 'remainingExceedsOriginal',
          message: `Loan ${i + 1}: Remaining amount cannot exceed original amount`,
        };
      }
    }
    return null;
  });

  // ==========================================
  // Co-Borrowers Array Validation
  // ==========================================
  applyWhen(
    path.hasCoBorrower,
    (has) => has === true,
    (p) => {
      notEmpty(p.coBorrowers, { message: 'Please add at least one co-borrower' });
      // TODO: Apply coBorrowerValidation to each item
    }
  );

  // Co-borrower age validation
  validate(path.coBorrowers, (value) => {
    const coBorrowers = value as CoBorrower[];
    if (!coBorrowers || coBorrowers.length === 0) return null;

    const today = new Date();

    for (let i = 0; i < coBorrowers.length; i++) {
      const cb = coBorrowers[i];
      if (!cb.personalData?.birthDate) continue;

      const birth = new Date(cb.personalData.birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      if (age < 18) {
        return {
          code: 'coBorrowerTooYoung',
          message: `Co-borrower ${i + 1}: Must be at least 18 years old`,
        };
      }
    }
    return null;
  });
};

export { propertyValidation, existingLoanValidation, coBorrowerValidation };
