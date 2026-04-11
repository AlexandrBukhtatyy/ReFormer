import { type Page, type Locator, expect } from '@playwright/test';

// ============================================================================
// Types
// ============================================================================

export type FormVariant = 'compound' | 'renderer';

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type Gender = 'male' | 'female';

export interface CreditFormPageOptions {
  basePath?: string;
  variant?: FormVariant;
}

// ============================================================================
// BasePage (inline for now, can be extracted later)
// ============================================================================

abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }
}

// ============================================================================
// CreditFormPage - Page Object Model for Credit Application Form
// ============================================================================

/**
 * Page Object Model for Credit Application Form
 * Supports both compound and renderer variants
 * Uses data-testid selectors for test stability
 */
export class CreditFormPage extends BasePage {
  readonly variant: FormVariant;
  readonly basePath: string;

  // Navigation buttons
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly submitButton: Locator;
  readonly stepIndicator: Locator;

  // Error tracking
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page, options?: CreditFormPageOptions) {
    super(page);
    this.basePath = options?.basePath ?? '/examples/complex';
    this.variant = options?.variant ?? 'compound';

    // Navigation buttons (use data-testid)
    this.nextButton = page.locator('[data-testid="btn-next"]');
    this.prevButton = page.locator('[data-testid="btn-previous"]');
    this.submitButton = page.locator('[data-testid="btn-submit"]');
    this.stepIndicator = page.locator('[class*="step"]');

    // Error tracking
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      this.pageErrors.push(error.message);
    });
  }

  // ============================================================================
  // Variant Helpers
  // ============================================================================

  isRenderer(): boolean {
    return this.variant === 'renderer';
  }

  isCompound(): boolean {
    return this.variant === 'compound';
  }

  // ============================================================================
  // Selectors by data-testid
  // ============================================================================

  /** Get field container by testid */
  field(testId: string): Locator {
    return this.page.locator(`[data-testid="field-${testId}"]`);
  }

  /** Get input by testid */
  input(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}"]`);
  }

  /** Get label by testid */
  label(testId: string): Locator {
    return this.page.locator(`[data-testid="label-${testId}"]`);
  }

  /** Get error message by testid */
  error(testId: string): Locator {
    return this.page.locator(`[data-testid="error-${testId}"]`);
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  async goto() {
    await this.page.goto(this.basePath);
    await this.page.waitForLoadState('networkidle');
    await this.waitForFormReady();
  }

  async waitForFormReady() {
    // Wait for loading indicator to disappear
    await this.page
      .waitForSelector('text=Загрузка данных...', { state: 'hidden', timeout: 10000 })
      .catch(() => {});
    // Wait for first step heading to appear
    await expect(
      this.page.getByRole('heading', { name: /основная информация о кредите/i })
    ).toBeVisible({ timeout: 10000 });
  }

  async goToNextStep() {
    await this.nextButton.click();
    await this.page.waitForTimeout(300);
  }

  async goToPreviousStep() {
    await this.prevButton.click();
    await this.page.waitForTimeout(300);
  }

  async goToStep(stepNumber: number) {
    const stepButton = this.page
      .locator(`[class*="step"]`)
      .filter({ hasText: String(stepNumber) })
      .first();
    await stepButton.click();
    await this.page.waitForTimeout(300);
  }

  async submitForm() {
    await this.submitButton.click();
    await this.page.waitForTimeout(500);
  }

  async getCurrentStep(): Promise<number> {
    const stepText = await this.page.locator('text=/Шаг \\d+ из/').textContent();
    const match = stepText?.match(/Шаг (\d+) из/);
    return match ? parseInt(match[1], 10) : 1;
  }

  // ============================================================================
  // Step 1: Basic Loan Information
  // ============================================================================

  async selectLoanType(type: LoanType) {
    const labels: Record<LoanType, string> = {
      consumer: 'Потребительский кредит',
      mortgage: 'Ипотека',
      car: 'Автокредит',
      business: 'Кредит для бизнеса',
      refinancing: 'Рефинансирование',
    };

    await this.input('loanType').click();
    await this.page.getByRole('option', { name: labels[type] }).click();
  }

  async fillLoanAmount(amount: number) {
    await this.input('loanAmount').fill(String(amount));
  }

  async fillLoanTerm(months: number) {
    await this.input('loanTerm').fill(String(months));
  }

  async fillLoanPurpose(purpose: string) {
    await this.input('loanPurpose').fill(purpose);
  }

  // Mortgage specific fields
  async fillPropertyValue(value: number) {
    await this.input('propertyValue').fill(String(value));
  }

  async fillInitialPayment(amount: number) {
    await this.input('initialPayment').fill(String(amount));
  }

  // Car loan specific fields
  async fillCarBrand(brand: string) {
    await this.input('carBrand').fill(brand);
  }

  async selectCarModel(model: string) {
    await this.input('carModel').click();
    await this.page.getByRole('option', { name: model }).click();
  }

  async fillCarYear(year: number) {
    await this.input('carYear').fill(String(year));
  }

  async fillCarPrice(price: number) {
    await this.input('carPrice').fill(String(price));
  }

  // ============================================================================
  // Step 2: Personal Data (nested form personalData)
  // ============================================================================

  async fillLastName(lastName: string) {
    await this.input('personalData-lastName').fill(lastName);
  }

  async fillFirstName(firstName: string) {
    await this.input('personalData-firstName').fill(firstName);
  }

  async fillMiddleName(middleName: string) {
    await this.input('personalData-middleName').fill(middleName);
  }

  async fillBirthDate(date: string) {
    await this.input('personalData-birthDate').fill(date);
  }

  async selectGender(gender: Gender) {
    await this.page.locator(`[data-testid="input-personalData-gender-${gender}"]`).click();
  }

  async fillBirthPlace(place: string) {
    await this.input('personalData-birthPlace').fill(place);
  }

  // Passport data (nested form passportData)
  async fillPassportSeries(series: string) {
    await this.input('passportData-series').fill(series);
  }

  async fillPassportNumber(number: string) {
    await this.input('passportData-number').fill(number);
  }

  async fillPassportIssuedBy(issuedBy: string) {
    await this.input('passportData-issuedBy').fill(issuedBy);
  }

  async fillPassportIssuedDate(date: string) {
    await this.input('passportData-issueDate').fill(date);
  }

  async fillPassportCode(code: string) {
    await this.input('passportData-departmentCode').fill(code);
  }

  async fillInn(inn: string) {
    await this.input('inn').fill(inn);
  }

  async fillSnils(snils: string) {
    await this.input('snils').fill(snils);
  }

  // ============================================================================
  // Step 3: Contact Information
  // ============================================================================

  async fillPhone(phone: string) {
    await this.input('phoneMain').fill(phone);
  }

  async fillPhoneAdditional(phone: string) {
    await this.input('phoneAdditional').fill(phone);
  }

  async fillEmail(email: string) {
    await this.input('email').fill(email);
  }

  async fillEmailAdditional(email: string) {
    await this.input('emailAdditional').fill(email);
  }

  // Registration Address
  async fillRegion(region: string) {
    await this.input('registrationAddress-region').fill(region);
  }

  async fillCity(city: string) {
    await this.input('registrationAddress-city').fill(city);
  }

  async fillStreet(street: string) {
    await this.input('registrationAddress-street').fill(street);
  }

  async fillHouse(house: string) {
    await this.input('registrationAddress-house').fill(house);
  }

  async fillApartment(apartment: string) {
    await this.input('registrationAddress-apartment').fill(apartment);
  }

  async fillPostalCode(code: string) {
    await this.input('registrationAddress-postalCode').fill(code);
  }

  async toggleSameAsRegistration(enable: boolean) {
    const checkbox = this.input('sameAsRegistration');
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enable) {
      await checkbox.click();
    }
  }

  // Residence Address (when different from registration)
  async fillResidenceRegion(region: string) {
    await this.input('residenceAddress-region').fill(region);
  }

  async fillResidenceCity(city: string) {
    await this.input('residenceAddress-city').fill(city);
  }

  async fillResidenceStreet(street: string) {
    await this.input('residenceAddress-street').fill(street);
  }

  async fillResidenceHouse(house: string) {
    await this.input('residenceAddress-house').fill(house);
  }

  async fillResidenceApartment(apartment: string) {
    await this.input('residenceAddress-apartment').fill(apartment);
  }

  async fillResidencePostalCode(code: string) {
    await this.input('residenceAddress-postalCode').fill(code);
  }

  // ============================================================================
  // Step 4: Employment and Income
  // ============================================================================

  async selectEmploymentStatus(status: EmploymentStatus) {
    await this.page.locator(`[data-testid="input-employmentStatus-${status}"]`).click();
  }

  async fillCompanyName(name: string) {
    await this.input('companyName').fill(name);
  }

  async fillCompanyInn(inn: string) {
    await this.input('companyInn').fill(inn);
  }

  async fillCompanyPhone(phone: string) {
    await this.input('companyPhone').fill(phone);
  }

  async fillCompanyAddress(address: string) {
    await this.input('companyAddress').fill(address);
  }

  async fillPosition(position: string) {
    await this.input('position').fill(position);
  }

  async fillMonthlyIncome(income: number) {
    await this.input('monthlyIncome').fill(String(income));
  }

  async fillAdditionalIncome(income: number) {
    await this.input('additionalIncome').fill(String(income));
  }

  async fillAdditionalIncomeSource(source: string) {
    await this.input('additionalIncomeSource').fill(source);
  }

  async fillWorkExperience(months: number) {
    await this.input('workExperienceTotal').fill(String(months));
  }

  async fillCurrentJobExperience(months: number) {
    await this.input('workExperienceCurrent').fill(String(months));
  }

  // Self-employed specific fields
  async fillBusinessType(type: string) {
    await this.input('businessType').fill(type);
  }

  async fillBusinessInn(inn: string) {
    await this.input('businessInn').fill(inn);
  }

  async fillBusinessActivity(activity: string) {
    await this.input('businessActivity').fill(activity);
  }

  // ============================================================================
  // Step 5: Additional Information
  // ============================================================================

  async selectMaritalStatus(status: MaritalStatus) {
    await this.page.locator(`[data-testid="input-maritalStatus-${status}"]`).click();
  }

  async fillDependents(count: number) {
    await this.input('dependents').fill(String(count));
  }

  async selectEducation(education: EducationLevel) {
    const labels: Record<EducationLevel, string> = {
      secondary: 'Среднее',
      specialized: 'Среднее специальное',
      higher: 'Высшее',
      postgraduate: 'Послевузовское',
    };

    await this.input('education').click();
    await this.page.getByRole('option', { name: labels[education] }).click();
  }

  async toggleHasProperty(enable: boolean) {
    const checkbox = this.input('hasProperty');
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enable) {
      await checkbox.click();
    }
  }

  async toggleHasLoans(enable: boolean) {
    const checkbox = this.input('hasExistingLoans');
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enable) {
      await checkbox.click();
    }
  }

  async toggleAddCoBorrower(enable: boolean) {
    const checkbox = this.input('hasCoBorrower');
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enable) {
      await checkbox.click();
    }
  }

  // Property array methods
  async addProperty() {
    await this.page.getByRole('button', { name: /добавить имущество/i }).click();
  }

  async removeProperty(index: number) {
    const deleteButtons = this.page
      .locator('[class*="property"]')
      .getByRole('button', { name: /удалить/i });
    await deleteButtons.nth(index).click();
  }

  // Existing loans array methods
  async addExistingLoan() {
    await this.page.getByRole('button', { name: /добавить кредит/i }).click();
  }

  async removeExistingLoan(index: number) {
    const deleteButtons = this.page
      .locator('[class*="loan"]')
      .getByRole('button', { name: /удалить/i });
    await deleteButtons.nth(index).click();
  }

  // Co-borrower array methods
  async addCoBorrower() {
    await this.page.getByRole('button', { name: /добавить созаемщика/i }).click();
  }

  async removeCoBorrower(index: number) {
    const deleteButtons = this.page
      .locator('[class*="coborrower"]')
      .getByRole('button', { name: /удалить/i });
    await deleteButtons.nth(index).click();
  }

  // ============================================================================
  // Step 6: Confirmation
  // ============================================================================

  async acceptPersonalDataAgreement() {
    await this.input('agreePersonalData').check();
  }

  async acceptCreditHistoryAgreement() {
    await this.input('agreeCreditHistory').check();
  }

  async acceptTermsAgreement() {
    await this.input('agreeTerms').check();
  }

  async acceptAccuracyConfirmation() {
    await this.input('confirmAccuracy').check();
  }

  async acceptMarketingAgreement() {
    await this.input('agreeMarketing').check();
  }

  async fillSmsCode(code: string) {
    await this.input('electronicSignature').fill(code);
  }

  // ============================================================================
  // Assertions and Checks
  // ============================================================================

  async expectStepHeading(heading: string | RegExp) {
    await expect(this.page.getByRole('heading', { name: heading })).toBeVisible();
  }

  async expectFieldError(fieldTestId: string, errorText?: string | RegExp) {
    const errorElement = this.error(fieldTestId);
    await expect(errorElement).toBeVisible();

    if (errorText) {
      await expect(errorElement).toHaveText(errorText);
    }
  }

  async expectNoFieldError(fieldTestId: string) {
    const errorElement = this.error(fieldTestId);
    await expect(errorElement).not.toBeVisible();
  }

  async expectFieldVisible(fieldTestId: string) {
    await expect(this.field(fieldTestId)).toBeVisible();
  }

  async expectFieldHidden(fieldTestId: string) {
    await expect(this.field(fieldTestId)).not.toBeVisible();
  }

  async expectFieldValue(fieldTestId: string, value: string) {
    await expect(this.input(fieldTestId)).toHaveValue(value);
  }

  async expectFieldDisabled(fieldTestId: string) {
    await expect(this.input(fieldTestId)).toBeDisabled();
  }

  async expectFieldEnabled(fieldTestId: string) {
    await expect(this.input(fieldTestId)).toBeEnabled();
  }

  async expectSuccessMessage() {
    await expect(this.page.getByText(/заявка успешно отправлена/i)).toBeVisible();
  }

  async expectErrorMessage(text?: string | RegExp) {
    if (text) {
      await expect(this.page.getByText(text)).toBeVisible();
    } else {
      await expect(this.page.locator('.text-red-500')).toBeVisible();
    }
  }

  hasNoErrors(): boolean {
    return this.pageErrors.length === 0 && !this.consoleErrors.some((e) => e.includes('Error'));
  }

  hasNoStackOverflow(): boolean {
    return !this.pageErrors.some((e) => e.includes('Maximum call stack size exceeded'));
  }

  // ============================================================================
  // Step Filling Helpers
  // ============================================================================

  /**
   * Fill Step 1 (Basic loan info) - Consumer loan
   */
  async fillStep1ConsumerLoan(options?: {
    loanAmount?: number;
    loanTerm?: number;
    loanPurpose?: string;
  }) {
    await this.fillLoanAmount(options?.loanAmount ?? 500000);
    await this.fillLoanTerm(options?.loanTerm ?? 24);
    await this.fillLoanPurpose(options?.loanPurpose ?? 'Ремонт квартиры');
  }

  /**
   * Fill Step 1 (Basic loan info) - Mortgage
   */
  async fillStep1Mortgage(options?: {
    propertyValue?: number;
    initialPayment?: number;
    loanAmount?: number;
    loanTerm?: number;
  }) {
    await this.selectLoanType('mortgage');
    await this.fillPropertyValue(options?.propertyValue ?? 5000000);
    await this.fillInitialPayment(options?.initialPayment ?? 1000000);
    await this.fillLoanAmount(options?.loanAmount ?? 4000000);
    await this.fillLoanTerm(options?.loanTerm ?? 240);
  }

  /**
   * Fill Step 1 (Basic loan info) - Car loan
   */
  async fillStep1CarLoan(options?: {
    carBrand?: string;
    carYear?: number;
    carPrice?: number;
    loanAmount?: number;
    loanTerm?: number;
  }) {
    await this.selectLoanType('car');
    await this.fillCarBrand(options?.carBrand ?? 'Toyota');
    await this.fillCarYear(options?.carYear ?? 2023);
    await this.fillCarPrice(options?.carPrice ?? 3000000);
    await this.fillLoanAmount(options?.loanAmount ?? 2500000);
    await this.fillLoanTerm(options?.loanTerm ?? 60);
  }

  /**
   * Fill Step 2 (Personal data)
   */
  async fillStep2PersonalData(options?: {
    lastName?: string;
    firstName?: string;
    middleName?: string;
    birthDate?: string;
    gender?: Gender;
    birthPlace?: string;
    passportSeries?: string;
    passportNumber?: string;
    passportIssuedBy?: string;
    passportIssuedDate?: string;
    passportCode?: string;
    inn?: string;
    snils?: string;
  }) {
    await this.fillLastName(options?.lastName ?? 'Иванов');
    await this.fillFirstName(options?.firstName ?? 'Иван');
    await this.fillMiddleName(options?.middleName ?? 'Иванович');
    await this.fillBirthDate(options?.birthDate ?? '1990-05-15');
    await this.selectGender(options?.gender ?? 'male');
    await this.fillBirthPlace(options?.birthPlace ?? 'г. Москва');
    await this.fillPassportSeries(options?.passportSeries ?? '45 06');
    await this.fillPassportNumber(options?.passportNumber ?? '123456');
    await this.fillPassportIssuedBy(options?.passportIssuedBy ?? 'ОВД Центрального района г. Москвы');
    await this.fillPassportIssuedDate(options?.passportIssuedDate ?? '2010-06-20');
    await this.fillPassportCode(options?.passportCode ?? '770-001');
    await this.fillInn(options?.inn ?? '123456789012');
    await this.fillSnils(options?.snils ?? '123-456-789 01');
  }

  /**
   * Fill Step 3 (Contact information)
   */
  async fillStep3ContactInfo(options?: {
    phone?: string;
    email?: string;
    region?: string;
    city?: string;
    street?: string;
    house?: string;
    apartment?: string;
    postalCode?: string;
  }) {
    await this.fillPhone(options?.phone ?? '+7 (999) 123-45-67');
    await this.fillEmail(options?.email ?? 'ivanov@example.com');
    await this.fillRegion(options?.region ?? 'Московская область');
    await this.fillCity(options?.city ?? 'Москва');
    await this.fillStreet(options?.street ?? 'Тверская');
    await this.fillHouse(options?.house ?? '1');
    await this.fillApartment(options?.apartment ?? '10');
    await this.fillPostalCode(options?.postalCode ?? '123456');
  }

  /**
   * Fill Step 4 (Employment) - Employed
   */
  async fillStep4Employment(options?: {
    companyName?: string;
    companyInn?: string;
    companyPhone?: string;
    companyAddress?: string;
    position?: string;
    workExperience?: number;
    currentJobExperience?: number;
    monthlyIncome?: number;
    additionalIncome?: number;
  }) {
    await this.selectEmploymentStatus('employed');
    await this.fillCompanyName(options?.companyName ?? 'ООО Тестовая компания');
    await this.fillCompanyInn(options?.companyInn ?? '1234567890');
    await this.fillCompanyPhone(options?.companyPhone ?? '+7 (999) 111-22-33');
    await this.fillCompanyAddress(options?.companyAddress ?? 'г. Москва, ул. Тестовая, д. 1');
    await this.fillPosition(options?.position ?? 'Менеджер');
    await this.fillWorkExperience(options?.workExperience ?? 60);
    await this.fillCurrentJobExperience(options?.currentJobExperience ?? 24);
    await this.fillMonthlyIncome(options?.monthlyIncome ?? 150000);
    await this.fillAdditionalIncome(options?.additionalIncome ?? 0);
  }

  /**
   * Fill Step 4 (Employment) - Self-employed
   */
  async fillStep4SelfEmployed(options?: {
    businessType?: string;
    businessInn?: string;
    businessActivity?: string;
    monthlyIncome?: number;
    additionalIncome?: number;
  }) {
    await this.selectEmploymentStatus('selfEmployed');
    await this.fillBusinessType(options?.businessType ?? 'ИП');
    await this.fillBusinessInn(options?.businessInn ?? '123456789012');
    await this.fillBusinessActivity(options?.businessActivity ?? 'Консалтинг');
    await this.fillMonthlyIncome(options?.monthlyIncome ?? 200000);
    await this.fillAdditionalIncome(options?.additionalIncome ?? 0);
  }

  /**
   * Fill Step 5 (Additional information)
   */
  async fillStep5AdditionalInfo(options?: {
    maritalStatus?: MaritalStatus;
    dependents?: number;
    education?: EducationLevel;
    hasProperty?: boolean;
    hasLoans?: boolean;
    hasCoBorrower?: boolean;
  }) {
    await this.selectMaritalStatus(options?.maritalStatus ?? 'married');
    await this.fillDependents(options?.dependents ?? 1);
    await this.selectEducation(options?.education ?? 'higher');
    await this.toggleHasProperty(options?.hasProperty ?? false);
    await this.toggleHasLoans(options?.hasLoans ?? false);
    await this.toggleAddCoBorrower(options?.hasCoBorrower ?? false);
  }

  /**
   * Fill Step 6 (Confirmation)
   */
  async fillStep6Confirmation(options?: { smsCode?: string; acceptMarketing?: boolean }) {
    await this.acceptPersonalDataAgreement();
    await this.acceptCreditHistoryAgreement();
    await this.acceptTermsAgreement();
    await this.acceptAccuracyConfirmation();
    if (options?.acceptMarketing) {
      await this.acceptMarketingAgreement();
    }
    await this.fillSmsCode(options?.smsCode ?? '123456');
  }

  // ============================================================================
  // Navigation Helpers
  // ============================================================================

  /**
   * Navigate through steps 1-3 with data filling
   */
  async fillAndNavigateToStep4() {
    // Step 1
    await this.fillStep1ConsumerLoan();
    await this.goToNextStep();

    // Step 2
    await this.fillStep2PersonalData();
    await this.goToNextStep();

    // Step 3
    await this.fillStep3ContactInfo();
    await this.goToNextStep();
  }

  /**
   * Navigate through steps 1-5 with data filling
   */
  async fillAndNavigateToStep6() {
    // Steps 1-3
    await this.fillAndNavigateToStep4();

    // Step 4
    await this.fillStep4Employment();
    await this.goToNextStep();

    // Step 5
    await this.fillStep5AdditionalInfo();
    await this.goToNextStep();
  }

  /**
   * Complete full form flow (Consumer Loan Happy Path)
   */
  async completeConsumerLoanHappyPath() {
    await this.fillAndNavigateToStep6();
    await this.fillStep6Confirmation();
    await this.submitForm();
  }
}
