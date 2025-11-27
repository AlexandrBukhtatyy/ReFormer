import { required, email, pattern, minLength, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, Address } from '@/types/credit-application.types';

// Reusable address validation schema
const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  required(path.region, { message: 'Region is required' });
  required(path.city, { message: 'City is required' });
  required(path.street, { message: 'Street is required' });
  required(path.house, { message: 'House number is required' });
  required(path.postalCode, { message: 'Postal code is required' });
  pattern(path.postalCode, /^\d{6}$/, { message: 'Postal code must be 6 digits' });
};

export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Phone Validation
  // ==========================================
  required(path.phoneMain, { message: 'Main phone number is required' });
  pattern(path.phoneMain, /^\+7\d{10}$/, {
    message: 'Phone must be in format +7XXXXXXXXXX'
  });

  // Additional phone is optional but must be valid if provided
  pattern(path.phoneAdditional, /^(\+7\d{10})?$/, {
    message: 'Phone must be in format +7XXXXXXXXXX'
  });

  // ==========================================
  // Email Validation
  // ==========================================
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Please enter a valid email address' });

  // Additional email is optional but must be valid if provided
  email(path.emailAdditional, { message: 'Please enter a valid email address' });

  // ==========================================
  // Registration Address Validation
  // ==========================================
  required(path.registrationAddress.region, { message: 'Region is required' });
  minLength(path.registrationAddress.region, 2, { message: 'Region must be at least 2 characters' });

  required(path.registrationAddress.city, { message: 'City is required' });
  minLength(path.registrationAddress.city, 2, { message: 'City must be at least 2 characters' });

  required(path.registrationAddress.street, { message: 'Street is required' });
  required(path.registrationAddress.house, { message: 'House number is required' });

  required(path.registrationAddress.postalCode, { message: 'Postal code is required' });
  pattern(path.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Postal code must be 6 digits'
  });

  // ==========================================
  // Residence Address Validation (when different from registration)
  // ==========================================
  applyWhen(
    path.sameAsRegistration,
    (same) => same === false,
    (p) => {
      required(p.residenceAddress.region, { message: 'Region is required' });
      minLength(p.residenceAddress.region, 2, { message: 'Region must be at least 2 characters' });

      required(p.residenceAddress.city, { message: 'City is required' });
      minLength(p.residenceAddress.city, 2, { message: 'City must be at least 2 characters' });

      required(p.residenceAddress.street, { message: 'Street is required' });
      required(p.residenceAddress.house, { message: 'House number is required' });

      required(p.residenceAddress.postalCode, { message: 'Postal code is required' });
      pattern(p.residenceAddress.postalCode, /^\d{6}$/, {
        message: 'Postal code must be 6 digits'
      });
    }
  );
};

export { addressValidation };
