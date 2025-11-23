import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model для формы заявки на кредит
 * Использует data-testid селекторы для стабильности тестов
 */
export class CreditFormPage {
  readonly page: Page;
  readonly baseUrl = 'http://localhost:5173/examples/complex';

  // Навигация
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly submitButton: Locator;
  readonly stepIndicator: Locator;

  // Ошибки
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page) {
    this.page = page;

    // Кнопки навигации (используем data-testid)
    this.nextButton = page.locator('[data-testid="btn-next"]');
    this.prevButton = page.locator('[data-testid="btn-previous"]');
    this.submitButton = page.locator('[data-testid="btn-submit"]');
    this.stepIndicator = page.locator('[class*="step"]');

    // Отслеживание ошибок
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
  // Селекторы по data-testid
  // ============================================================================

  /** Получить поле (контейнер) по testid */
  field(testId: string): Locator {
    return this.page.locator(`[data-testid="field-${testId}"]`);
  }

  /** Получить input по testid */
  input(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}"]`);
  }

  /** Получить label по testid */
  label(testId: string): Locator {
    return this.page.locator(`[data-testid="label-${testId}"]`);
  }

  /** Получить сообщение об ошибке по testid */
  error(testId: string): Locator {
    return this.page.locator(`[data-testid="error-${testId}"]`);
  }

  // ============================================================================
  // Навигация
  // ============================================================================

  async goto() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForLoadState('networkidle');
    await this.waitForFormReady();
  }

  async waitForFormReady() {
    // Ждём пока форма загрузится (исчезнет индикатор загрузки)
    await this.page
      .waitForSelector('text=Загрузка данных...', { state: 'hidden', timeout: 10000 })
      .catch(() => {});
    // Ждём появления заголовка первого шага
    await expect(
      this.page.getByRole('heading', { name: /основная информация о кредите/i })
    ).toBeVisible({ timeout: 10000 });
  }

  async goToNextStep() {
    await this.nextButton.click();
    await this.page.waitForTimeout(300); // Даём время на переход
  }

  async goToPreviousStep() {
    await this.prevButton.click();
    await this.page.waitForTimeout(300);
  }

  async goToStep(stepNumber: number) {
    // Клик по индикатору шага (если разрешено)
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
  // Шаг 1: Основная информация о кредите
  // ============================================================================

  async selectLoanType(type: 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing') {
    const labels: Record<string, string> = {
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

  // Поля ипотеки
  async fillPropertyValue(value: number) {
    await this.input('propertyValue').fill(String(value));
  }

  // Поля автокредита
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
  // Шаг 2: Персональные данные (вложенная форма personalData)
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

  async selectGender(gender: 'male' | 'female') {
    // RadioGroup имеет data-testid на каждом radio: input-personalData-gender-male/female
    await this.page.locator(`[data-testid="input-personalData-gender-${gender}"]`).click();
  }

  async fillBirthPlace(place: string) {
    await this.input('personalData-birthPlace').fill(place);
  }

  // Паспортные данные (вложенная форма passportData)
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
  // Шаг 3: Контактная информация
  // ============================================================================

  async fillPhone(phone: string) {
    await this.input('phoneMain').fill(phone);
  }

  async fillEmail(email: string) {
    await this.input('email').fill(email);
  }

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

  // ============================================================================
  // Шаг 4: Занятость и доход
  // ============================================================================

  async selectEmploymentStatus(
    status: 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student'
  ) {
    // RadioGroup имеет data-testid на каждом radio: input-employmentStatus-{value}
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

  async fillWorkExperience(months: number) {
    await this.input('workExperienceTotal').fill(String(months));
  }

  async fillCurrentJobExperience(months: number) {
    await this.input('workExperienceCurrent').fill(String(months));
  }

  // ============================================================================
  // Шаг 5: Дополнительная информация
  // ============================================================================

  async selectMaritalStatus(status: 'single' | 'married' | 'divorced' | 'widowed') {
    // RadioGroup имеет data-testid на каждом radio: input-maritalStatus-{value}
    await this.page.locator(`[data-testid="input-maritalStatus-${status}"]`).click();
  }

  async fillDependents(count: number) {
    await this.input('dependents').fill(String(count));
  }

  async selectEducation(education: 'secondary' | 'specialized' | 'higher' | 'postgraduate') {
    const labels: Record<string, string> = {
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

  async addProperty() {
    await this.page.getByRole('button', { name: /добавить имущество/i }).click();
  }

  async removeProperty(index: number) {
    const deleteButtons = this.page
      .locator('[class*="property"]')
      .getByRole('button', { name: /удалить/i });
    await deleteButtons.nth(index).click();
  }

  // ============================================================================
  // Шаг 6: Подтверждение
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

  async fillSmsCode(code: string) {
    await this.input('electronicSignature').fill(code);
  }

  // ============================================================================
  // Утилиты и проверки
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
  // Хелперы для заполнения шагов
  // ============================================================================

  /**
   * Заполнить шаг 1 (основная информация о кредите) - потребительский кредит
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
   * Заполнить шаг 2 (персональные данные)
   */
  async fillStep2PersonalData() {
    await this.fillLastName('Иванов');
    await this.fillFirstName('Иван');
    await this.fillMiddleName('Иванович');
    await this.fillBirthDate('1990-05-15');
    await this.selectGender('male');
    await this.fillBirthPlace('г. Москва');
    await this.fillPassportSeries('45 06');
    await this.fillPassportNumber('123456');
    await this.fillPassportIssuedBy('ОВД Центрального района г. Москвы');
    await this.fillPassportIssuedDate('2010-06-20');
    await this.fillPassportCode('770-001');
    await this.fillInn('123456789012');
    await this.fillSnils('123-456-789 01');
  }

  /**
   * Заполнить шаг 3 (контактная информация)
   */
  async fillStep3ContactInfo() {
    await this.fillPhone('+7 (999) 123-45-67');
    await this.fillEmail('ivanov@example.com');
    await this.fillRegion('Московская область');
    await this.fillCity('Москва');
    await this.fillStreet('Тверская');
    await this.fillHouse('1');
    await this.fillApartment('10');
    await this.fillPostalCode('123456');
  }

  /**
   * Пройти через шаги 1-3 с заполнением данных
   */
  async fillAndNavigateToStep4() {
    // Шаг 1
    await this.fillStep1ConsumerLoan();
    await this.goToNextStep();

    // Шаг 2
    await this.fillStep2PersonalData();
    await this.goToNextStep();

    // Шаг 3
    await this.fillStep3ContactInfo();
    await this.goToNextStep();
  }

  /**
   * Заполнить шаг 4 (занятость и доход) - работающий
   */
  async fillStep4Employment() {
    await this.selectEmploymentStatus('employed');
    await this.fillCompanyName('ООО Тестовая компания');
    await this.fillCompanyInn('1234567890');
    await this.fillCompanyPhone('+7 (999) 111-22-33');
    await this.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
    await this.fillPosition('Менеджер');
    await this.fillWorkExperience(60);
    await this.fillCurrentJobExperience(24);
    await this.fillMonthlyIncome(150000);
    await this.fillAdditionalIncome(0);
  }

  /**
   * Заполнить шаг 5 (дополнительная информация)
   */
  async fillStep5AdditionalInfo() {
    await this.selectMaritalStatus('married');
    await this.fillDependents(1);
    await this.selectEducation('higher');
    await this.toggleHasProperty(false);
    await this.toggleHasLoans(false);
    await this.toggleAddCoBorrower(false);
  }

  /**
   * Пройти через шаги 1-5 с заполнением данных
   */
  async fillAndNavigateToStep6() {
    // Шаги 1-3
    await this.fillAndNavigateToStep4();

    // Шаг 4
    await this.fillStep4Employment();
    await this.goToNextStep();

    // Шаг 5
    await this.fillStep5AdditionalInfo();
    await this.goToNextStep();
  }
}
