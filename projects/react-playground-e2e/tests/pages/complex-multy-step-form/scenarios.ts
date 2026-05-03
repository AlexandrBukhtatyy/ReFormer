/**
 * Reusable test scenarios for Credit Application Form
 * These scenarios encapsulate common test flows that can be used across different test files
 */

import {
  CreditFormPage,
  type Gender,
  type MaritalStatus,
  type EducationLevel,
} from './credit-form-page.pom';

// ============================================================================
// Types for Scenario Data
// ============================================================================

export interface PersonalDataInput {
  lastName?: string;
  firstName?: string;
  middleName?: string;
  birthDate?: string;
  gender?: Gender;
  birthPlace?: string;
}

export interface PassportDataInput {
  series?: string;
  number?: string;
  issuedBy?: string;
  issuedDate?: string;
  code?: string;
}

export interface ContactDataInput {
  phone?: string;
  email?: string;
  region?: string;
  city?: string;
  street?: string;
  house?: string;
  apartment?: string;
  postalCode?: string;
}

export interface EmploymentDataInput {
  companyName?: string;
  companyInn?: string;
  companyPhone?: string;
  companyAddress?: string;
  position?: string;
  workExperience?: number;
  currentJobExperience?: number;
  monthlyIncome?: number;
  additionalIncome?: number;
}

export interface AdditionalInfoInput {
  maritalStatus?: MaritalStatus;
  dependents?: number;
  education?: EducationLevel;
  hasProperty?: boolean;
  hasLoans?: boolean;
  hasCoBorrower?: boolean;
}

// ============================================================================
// Step 1 Scenarios
// ============================================================================

/**
 * Fill Step 1 for Consumer Loan
 */
export async function fillStep1ConsumerLoan(
  form: CreditFormPage,
  options?: {
    loanAmount?: number;
    loanTerm?: number;
    loanPurpose?: string;
  }
) {
  // Consumer loan is default type, no need to select
  await form.fillLoanAmount(options?.loanAmount ?? 500000);
  await form.fillLoanTerm(options?.loanTerm ?? 24);
  await form.fillLoanPurpose(options?.loanPurpose ?? 'Ремонт квартиры');
}

/**
 * Fill Step 1 for Mortgage
 */
export async function fillStep1Mortgage(
  form: CreditFormPage,
  options?: {
    propertyValue?: number;
    initialPayment?: number;
    loanAmount?: number;
    loanTerm?: number;
  }
) {
  await form.selectLoanType('mortgage');
  await form.fillPropertyValue(options?.propertyValue ?? 5000000);
  await form.fillInitialPayment(options?.initialPayment ?? 1000000);
  await form.fillLoanAmount(options?.loanAmount ?? 4000000);
  await form.fillLoanTerm(options?.loanTerm ?? 240);
}

/**
 * Fill Step 1 for Car Loan
 */
export async function fillStep1CarLoan(
  form: CreditFormPage,
  options?: {
    carBrand?: string;
    carYear?: number;
    carPrice?: number;
    loanAmount?: number;
    loanTerm?: number;
  }
) {
  await form.selectLoanType('car');
  await form.fillCarBrand(options?.carBrand ?? 'Toyota');
  await form.fillCarYear(options?.carYear ?? 2023);
  await form.fillCarPrice(options?.carPrice ?? 3000000);
  await form.fillLoanAmount(options?.loanAmount ?? 2500000);
  await form.fillLoanTerm(options?.loanTerm ?? 60);
}

// ============================================================================
// Step 2 Scenarios
// ============================================================================

/**
 * Fill Step 2 Personal Data with default or custom values
 */
export async function fillStep2PersonalData(
  form: CreditFormPage,
  personalData?: PersonalDataInput,
  passportData?: PassportDataInput,
  documents?: { inn?: string; snils?: string }
) {
  // Personal data
  await form.fillLastName(personalData?.lastName ?? 'Иванов');
  await form.fillFirstName(personalData?.firstName ?? 'Иван');
  await form.fillMiddleName(personalData?.middleName ?? 'Иванович');
  await form.fillBirthDate(personalData?.birthDate ?? '1990-05-15');
  await form.selectGender(personalData?.gender ?? 'male');
  await form.fillBirthPlace(personalData?.birthPlace ?? 'г. Москва');

  // Passport data
  await form.fillPassportSeries(passportData?.series ?? '45 06');
  await form.fillPassportNumber(passportData?.number ?? '123456');
  await form.fillPassportIssuedBy(passportData?.issuedBy ?? 'ОВД Центрального района г. Москвы');
  await form.fillPassportIssuedDate(passportData?.issuedDate ?? '2010-06-20');
  await form.fillPassportCode(passportData?.code ?? '770-001');

  // Documents
  await form.fillInn(documents?.inn ?? '123456789012');
  await form.fillSnils(documents?.snils ?? '123-456-789 01');
}

/**
 * Fill Step 2 with female data
 */
export async function fillStep2PersonalDataFemale(form: CreditFormPage) {
  await fillStep2PersonalData(
    form,
    {
      lastName: 'Петрова',
      firstName: 'Анна',
      middleName: 'Сергеевна',
      birthDate: '1985-03-20',
      gender: 'female',
      birthPlace: 'г. Санкт-Петербург',
    },
    {
      series: '40 15',
      number: '654321',
      issuedBy: 'УФМС России по г. Санкт-Петербургу',
      issuedDate: '2015-04-10',
      code: '780-002',
    },
    {
      inn: '782512345678',
      snils: '987-654-321 00',
    }
  );
}

// ============================================================================
// Step 3 Scenarios
// ============================================================================

/**
 * Fill Step 3 Contact Information
 */
export async function fillStep3ContactInfo(form: CreditFormPage, contactData?: ContactDataInput) {
  await form.fillPhone(contactData?.phone ?? '+7 (999) 123-45-67');
  await form.fillEmail(contactData?.email ?? 'ivanov@example.com');
  await form.fillRegion(contactData?.region ?? 'Московская область');
  await form.fillCity(contactData?.city ?? 'Москва');
  await form.fillStreet(contactData?.street ?? 'Тверская');
  await form.fillHouse(contactData?.house ?? '1');
  await form.fillApartment(contactData?.apartment ?? '10');
  await form.fillPostalCode(contactData?.postalCode ?? '123456');
}

/**
 * Fill Step 3 with different residence address
 */
export async function fillStep3WithDifferentResidence(
  form: CreditFormPage,
  registrationData?: ContactDataInput,
  residenceData?: ContactDataInput
) {
  // Registration address
  await fillStep3ContactInfo(form, registrationData);

  // Uncheck "same as registration"
  await form.toggleSameAsRegistration(false);

  // Fill residence address
  await form.fillResidenceRegion(residenceData?.region ?? 'Ленинградская область');
  await form.fillResidenceCity(residenceData?.city ?? 'Санкт-Петербург');
  await form.fillResidenceStreet(residenceData?.street ?? 'Невский проспект');
  await form.fillResidenceHouse(residenceData?.house ?? '50');
  await form.fillResidenceApartment(residenceData?.apartment ?? '15');
  await form.fillResidencePostalCode(residenceData?.postalCode ?? '190000');
}

// ============================================================================
// Step 4 Scenarios
// ============================================================================

/**
 * Fill Step 4 Employment - Employed
 */
export async function fillStep4Employed(
  form: CreditFormPage,
  employmentData?: EmploymentDataInput
) {
  await form.selectEmploymentStatus('employed');
  await form.fillCompanyName(employmentData?.companyName ?? 'ООО Тестовая компания');
  await form.fillCompanyInn(employmentData?.companyInn ?? '1234567890');
  await form.fillCompanyPhone(employmentData?.companyPhone ?? '+7 (999) 111-22-33');
  await form.fillCompanyAddress(employmentData?.companyAddress ?? 'г. Москва, ул. Тестовая, д. 1');
  await form.fillPosition(employmentData?.position ?? 'Менеджер');
  await form.fillWorkExperience(employmentData?.workExperience ?? 60);
  await form.fillCurrentJobExperience(employmentData?.currentJobExperience ?? 24);
  await form.fillMonthlyIncome(employmentData?.monthlyIncome ?? 150000);
  await form.fillAdditionalIncome(employmentData?.additionalIncome ?? 0);
}

/**
 * Fill Step 4 Employment - Self-Employed
 */
export async function fillStep4SelfEmployed(
  form: CreditFormPage,
  options?: {
    businessType?: string;
    businessInn?: string;
    businessActivity?: string;
    monthlyIncome?: number;
    additionalIncome?: number;
  }
) {
  await form.selectEmploymentStatus('selfEmployed');
  await form.fillBusinessType(options?.businessType ?? 'ИП');
  await form.fillBusinessInn(options?.businessInn ?? '123456789012');
  await form.fillBusinessActivity(options?.businessActivity ?? 'Консалтинг');
  await form.fillMonthlyIncome(options?.monthlyIncome ?? 200000);
  await form.fillAdditionalIncome(options?.additionalIncome ?? 0);
}

/**
 * Fill Step 4 Employment - Retired
 */
export async function fillStep4Retired(
  form: CreditFormPage,
  options?: {
    monthlyIncome?: number;
    additionalIncome?: number;
  }
) {
  await form.selectEmploymentStatus('retired');
  await form.fillMonthlyIncome(options?.monthlyIncome ?? 50000);
  await form.fillAdditionalIncome(options?.additionalIncome ?? 20000);
}

// ============================================================================
// Step 5 Scenarios
// ============================================================================

/**
 * Fill Step 5 Additional Information - Simple (no property, no loans, no co-borrower)
 */
export async function fillStep5Simple(form: CreditFormPage, additionalInfo?: AdditionalInfoInput) {
  await form.selectMaritalStatus(additionalInfo?.maritalStatus ?? 'married');
  await form.fillDependents(additionalInfo?.dependents ?? 1);
  await form.selectEducation(additionalInfo?.education ?? 'higher');
  await form.toggleHasProperty(additionalInfo?.hasProperty ?? false);
  await form.toggleHasLoans(additionalInfo?.hasLoans ?? false);
  await form.toggleAddCoBorrower(additionalInfo?.hasCoBorrower ?? false);
}

/**
 * Fill Step 5 with Property
 */
export async function fillStep5WithProperty(
  form: CreditFormPage,
  additionalInfo?: AdditionalInfoInput
) {
  await form.selectMaritalStatus(additionalInfo?.maritalStatus ?? 'married');
  await form.fillDependents(additionalInfo?.dependents ?? 2);
  await form.selectEducation(additionalInfo?.education ?? 'higher');

  // Add property
  await form.toggleHasProperty(true);
  await form.addProperty();
  // Property form fields would be filled here if needed

  await form.toggleHasLoans(additionalInfo?.hasLoans ?? false);
  await form.toggleAddCoBorrower(additionalInfo?.hasCoBorrower ?? false);
}

/**
 * Fill Step 5 Single person profile
 */
export async function fillStep5SinglePerson(form: CreditFormPage) {
  await form.selectMaritalStatus('single');
  await form.fillDependents(0);
  await form.selectEducation('higher');
  await form.toggleHasProperty(false);
  await form.toggleHasLoans(false);
  await form.toggleAddCoBorrower(false);
}

// ============================================================================
// Step 6 Scenarios
// ============================================================================

/**
 * Fill Step 6 Confirmation - All required agreements
 */
export async function fillStep6Confirmation(
  form: CreditFormPage,
  options?: {
    smsCode?: string;
    acceptMarketing?: boolean;
  }
) {
  await form.acceptPersonalDataAgreement();
  await form.acceptCreditHistoryAgreement();
  await form.acceptTermsAgreement();
  await form.acceptAccuracyConfirmation();

  if (options?.acceptMarketing) {
    await form.acceptMarketingAgreement();
  }

  await form.fillSmsCode(options?.smsCode ?? '123456');
}

// ============================================================================
// Full Flow Happy Path Scenarios
// ============================================================================

/**
 * Consumer Loan Happy Path - Full flow
 */
export async function fillConsumerLoanHappyPath(
  form: CreditFormPage,
  options?: {
    loanAmount?: number;
    loanTerm?: number;
    monthlyIncome?: number;
  }
) {
  // Step 1: Basic info
  await fillStep1ConsumerLoan(form, {
    loanAmount: options?.loanAmount,
    loanTerm: options?.loanTerm,
  });
  await form.goToNextStep();

  // Step 2: Personal data
  await fillStep2PersonalData(form);
  await form.goToNextStep();

  // Step 3: Contact info
  await fillStep3ContactInfo(form);
  await form.goToNextStep();

  // Step 4: Employment
  await fillStep4Employed(form, {
    monthlyIncome: options?.monthlyIncome,
  });
  await form.goToNextStep();

  // Step 5: Additional info
  await fillStep5Simple(form);
  await form.goToNextStep();

  // Step 6: Confirmation
  await fillStep6Confirmation(form);
}

/**
 * Mortgage Happy Path - Full flow
 */
export async function fillMortgageHappyPath(
  form: CreditFormPage,
  options?: {
    propertyValue?: number;
    initialPayment?: number;
    loanAmount?: number;
    loanTerm?: number;
    monthlyIncome?: number;
  }
) {
  // Step 1: Basic info - Mortgage
  await fillStep1Mortgage(form, {
    propertyValue: options?.propertyValue,
    initialPayment: options?.initialPayment,
    loanAmount: options?.loanAmount,
    loanTerm: options?.loanTerm,
  });
  await form.goToNextStep();

  // Step 2: Personal data
  await fillStep2PersonalData(form);
  await form.goToNextStep();

  // Step 3: Contact info
  await fillStep3ContactInfo(form);
  await form.goToNextStep();

  // Step 4: Employment - Higher income for mortgage
  await fillStep4Employed(form, {
    monthlyIncome: options?.monthlyIncome ?? 250000,
    workExperience: 120,
    currentJobExperience: 60,
  });
  await form.goToNextStep();

  // Step 5: Additional info with property
  await fillStep5WithProperty(form);
  await form.goToNextStep();

  // Step 6: Confirmation
  await fillStep6Confirmation(form);
}

/**
 * Car Loan Happy Path - Full flow
 */
export async function fillCarLoanHappyPath(
  form: CreditFormPage,
  options?: {
    carBrand?: string;
    carPrice?: number;
    loanAmount?: number;
    loanTerm?: number;
    monthlyIncome?: number;
  }
) {
  // Step 1: Basic info - Car loan
  await fillStep1CarLoan(form, {
    carBrand: options?.carBrand,
    carPrice: options?.carPrice,
    loanAmount: options?.loanAmount,
    loanTerm: options?.loanTerm,
  });
  await form.goToNextStep();

  // Step 2: Personal data
  await fillStep2PersonalData(form);
  await form.goToNextStep();

  // Step 3: Contact info
  await fillStep3ContactInfo(form);
  await form.goToNextStep();

  // Step 4: Employment
  await fillStep4Employed(form, {
    monthlyIncome: options?.monthlyIncome ?? 120000,
  });
  await form.goToNextStep();

  // Step 5: Additional info - single person for car loan
  await fillStep5SinglePerson(form);
  await form.goToNextStep();

  // Step 6: Confirmation
  await fillStep6Confirmation(form);
}

// ============================================================================
// Partial Flow Scenarios (for specific test cases)
// ============================================================================

/**
 * Navigate to Step 4 with filled data
 */
export async function navigateToStep4WithData(form: CreditFormPage) {
  await fillStep1ConsumerLoan(form);
  await form.goToNextStep();

  await fillStep2PersonalData(form);
  await form.goToNextStep();

  await fillStep3ContactInfo(form);
  await form.goToNextStep();
}

/**
 * Navigate to Step 6 with filled data
 */
export async function navigateToStep6WithData(form: CreditFormPage) {
  await navigateToStep4WithData(form);

  await fillStep4Employed(form);
  await form.goToNextStep();

  await fillStep5Simple(form);
  await form.goToNextStep();
}

/**
 * Fill form but skip some required fields (for validation testing)
 */
export async function fillStep1WithMissingFields(form: CreditFormPage) {
  // Only fill loan amount, skip term and purpose
  await form.fillLoanAmount(500000);
}

/**
 * Fill form with invalid data (for validation testing)
 */
export async function fillStep1WithInvalidData(form: CreditFormPage) {
  await form.fillLoanAmount(10000); // Too low (min: 50000)
  await form.fillLoanTerm(3); // Too short (min: 6)
  await form.fillLoanPurpose('Ремонт'); // Too short (min: 10 chars)
}
