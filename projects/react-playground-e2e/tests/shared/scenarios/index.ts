/**
 * Scenarios barrel export
 */

export {
  // Step 1 scenarios
  fillStep1ConsumerLoan,
  fillStep1Mortgage,
  fillStep1CarLoan,

  // Step 2 scenarios
  fillStep2PersonalData,
  fillStep2PersonalDataFemale,

  // Step 3 scenarios
  fillStep3ContactInfo,
  fillStep3WithDifferentResidence,

  // Step 4 scenarios
  fillStep4Employed,
  fillStep4SelfEmployed,
  fillStep4Retired,

  // Step 5 scenarios
  fillStep5Simple,
  fillStep5WithProperty,
  fillStep5SinglePerson,

  // Step 6 scenarios
  fillStep6Confirmation,

  // Full flow happy paths
  fillConsumerLoanHappyPath,
  fillMortgageHappyPath,
  fillCarLoanHappyPath,

  // Partial flows
  navigateToStep4WithData,
  navigateToStep6WithData,

  // Validation testing
  fillStep1WithMissingFields,
  fillStep1WithInvalidData,

  // Types
  type PersonalDataInput,
  type PassportDataInput,
  type ContactDataInput,
  type EmploymentDataInput,
  type AdditionalInfoInput,
} from './credit-form.scenarios';
