/**
 * Data Builders для E2E тестов
 *
 * Builders используют паттерн Builder для создания тестовых данных
 * с поддержкой модификаторов для различных сценариев тестирования.
 *
 * @example
 * // Базовый сценарий
 * const data = creditFormBuilder.consumerLoan();
 *
 * @example
 * // С модификатором для негативного теста
 * const invalidData = creditFormBuilder.withInvalidEmail(
 *   creditFormBuilder.contactData()
 * );
 *
 * @example
 * // Полная форма
 * const completeForm = creditFormBuilder.completeConsumerLoan();
 */

export {
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
} from './credit-form.builder';

export {
  registrationBuilder,
  type RegistrationBuilder,
  type RegistrationFormData,
  type LoginFormData,
  type PasswordResetData,
  type ProfileData,
} from './registration.builder';
