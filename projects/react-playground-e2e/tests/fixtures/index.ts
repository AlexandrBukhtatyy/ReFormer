/**
 * Fixtures for E2E tests
 *
 * This module provides centralized access to all test data,
 * builders and utilities for E2E testing.
 *
 * @example
 * import { creditFormBuilder, VALID_PERSONAL_DATA } from '@fixtures';
 *
 * // Using static data
 * const personalData = VALID_PERSONAL_DATA;
 *
 * // Using builder with modifier
 * const invalidForm = creditFormBuilder.withInvalidEmail(
 *   creditFormBuilder.contactData()
 * );
 */

// ============================================================================
// Data Builders
// ============================================================================

export {
  // Credit Form Builder
  creditFormBuilder,
  type CreditFormBuilder,
  type LoanBaseData,
  type ConsumerLoanBuilderData,
  type MortgageLoanBuilderData,
  type CarLoanBuilderData,
  type BusinessLoanBuilderData,
  type RefinancingLoanBuilderData,
  type ContactData,
  type AdditionalInfo,
  type PropertyData,
  type ExistingLoanData,
  type CoBorrowerData,
  type ConsentsData,
  // Registration Builder
  registrationBuilder,
  type RegistrationBuilder,
  type RegistrationFormData,
  type LoginFormData,
  type PasswordResetData,
  type ProfileData,
} from './builders';

// ============================================================================
// Static Test Data
// ============================================================================

export {
  // Types
  type PersonalData,
  type PassportData,
  type AddressData,
  type EmploymentData,
  type ConsumerLoanData,
  type MortgageLoanData,
  type CarLoanData,
  // Loan Data
  CONSUMER_LOAN_DATA,
  MORTGAGE_LOAN_DATA,
  CAR_LOAN_DATA,
  // Personal Data
  VALID_PERSONAL_DATA,
  VALID_PASSPORT_DATA,
  VALID_INN,
  VALID_SNILS,
  // Contact Data
  VALID_PHONE,
  VALID_EMAIL,
  VALID_ADDRESS,
  // Employment Data
  EMPLOYED_DATA,
  SELF_EMPLOYED_DATA,
  UNEMPLOYED_DATA,
  // Additional Info
  ADDITIONAL_INFO,
  // Invalid Data for Negative Tests
  INVALID_DATA,
  CROSS_VALIDATION_DATA,
  // SMS Codes
  VALID_SMS_CODE,
  INVALID_SMS_CODE,
  // Complete Form Data
  COMPLETE_FORM_DATA,
} from './test-data';
