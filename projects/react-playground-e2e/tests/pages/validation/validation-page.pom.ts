import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Validation Examples Page
 * Tests built-in validators: required, email, minLength, maxLength, pattern, url, phone,
 * min, max, number, date validators, and custom validators
 */
export class ValidationPage {
  readonly page: Page;
  readonly baseUrl = '/examples/validation';

  // Section toggles
  readonly stringsSection: Locator;
  readonly numbersSection: Locator;
  readonly datesSection: Locator;
  readonly otherSection: Locator;

  // Control buttons
  readonly validateAllButton: Locator;
  readonly resetButton: Locator;

  // Error tracking
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page) {
    this.page = page;

    // Section toggles
    this.stringsSection = page.getByRole('button', { name: /строки/i });
    this.numbersSection = page.getByRole('button', { name: /числа/i });
    this.datesSection = page.getByRole('button', { name: /дата и время/i });
    this.otherSection = page.getByRole('button', { name: /другие/i });

    // Control buttons
    this.validateAllButton = page.getByRole('button', { name: /проверить все/i });
    this.resetButton = page.getByRole('button', { name: /сбросить/i });

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

  /** Get error message by testid */
  error(testId: string): Locator {
    return this.page.locator(`[data-testid="error-${testId}"]`);
  }

  // ============================================================================
  // Navigation
  // ============================================================================

  async goto() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForLoadState('networkidle');
    await this.waitForPageReady();
  }

  async waitForPageReady() {
    await expect(this.page.getByRole('heading', { name: /примеры валидации/i })).toBeVisible({
      timeout: 10000,
    });
  }

  // ============================================================================
  // Section Toggle
  // ============================================================================

  async expandAllSections() {
    const toggleAllButton = this.page.getByRole('button', { name: /развернуть все/i });
    if (await toggleAllButton.isVisible()) {
      await toggleAllButton.click();
    }
  }

  async collapseAllSections() {
    const toggleAllButton = this.page.getByRole('button', { name: /свернуть все/i });
    if (await toggleAllButton.isVisible()) {
      await toggleAllButton.click();
    }
  }

  async toggleSection(section: 'strings' | 'numbers' | 'dates' | 'other') {
    const sectionMap = {
      strings: this.stringsSection,
      numbers: this.numbersSection,
      dates: this.datesSection,
      other: this.otherSection,
    };
    await sectionMap[section].click();
  }

  // ============================================================================
  // String Validators
  // ============================================================================

  async fillRequiredField(value: string) {
    await this.input('requiredField').fill(value);
  }

  async fillEmailField(value: string) {
    await this.input('emailField').fill(value);
  }

  async fillMinLengthField(value: string) {
    await this.input('minLengthField').fill(value);
  }

  async fillMaxLengthField(value: string) {
    await this.input('maxLengthField').fill(value);
  }

  async fillPatternField(value: string) {
    await this.input('patternField').fill(value);
  }

  async fillUrlField(value: string) {
    await this.input('urlField').fill(value);
  }

  async fillPhoneField(value: string) {
    await this.input('phoneField').fill(value);
  }

  // ============================================================================
  // Number Validators
  // ============================================================================

  async fillMinField(value: number | string) {
    await this.input('minField').fill(String(value));
  }

  async fillMaxField(value: number | string) {
    await this.input('maxField').fill(String(value));
  }

  async fillNumberField(value: number | string) {
    await this.input('numberField').fill(String(value));
  }

  // ============================================================================
  // Date Validators
  // ============================================================================

  async fillDateField(value: string) {
    await this.input('dateField').fill(value);
  }

  async fillIsDateField(value: string) {
    await this.input('isDateField').fill(value);
  }

  async fillMinDateField(value: string) {
    await this.input('minDateField').fill(value);
  }

  async fillMaxDateField(value: string) {
    await this.input('maxDateField').fill(value);
  }

  async fillFutureDateField(value: string) {
    await this.input('futureDateField').fill(value);
  }

  async fillMinAgeField(value: string) {
    await this.input('minAgeField').fill(value);
  }

  async fillMaxAgeField(value: string) {
    await this.input('maxAgeField').fill(value);
  }

  // ============================================================================
  // Custom Validators
  // ============================================================================

  async fillCustomField(value: string) {
    await this.input('customField').fill(value);
  }

  // ============================================================================
  // Actions
  // ============================================================================

  async validateAll() {
    await this.validateAllButton.click();
  }

  async reset() {
    await this.resetButton.click();
  }

  async blurCurrentField() {
    await this.page.keyboard.press('Tab');
  }

  // ============================================================================
  // Assertions
  // ============================================================================

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

  async expectFieldValue(fieldTestId: string, value: string) {
    await expect(this.input(fieldTestId)).toHaveValue(value);
  }

  // ============================================================================
  // Test Data Helpers
  // ============================================================================

  getValidTestData() {
    return {
      // Strings
      requiredField: 'test value',
      emailField: 'test@example.com',
      minLengthField: 'abcdef', // 6 chars, min is 5
      maxLengthField: 'short', // 5 chars, max is 10
      patternField: 'letters', // only letters
      urlField: 'https://example.com',
      phoneField: '+7 900 123-45-67',
      // Numbers
      minField: 15, // min is 10
      maxField: 50, // max is 100
      numberField: 50, // integer 1-100
      // Dates
      dateField: '2020-06-15', // past date
      isDateField: '2024-01-15',
      minDateField: '2022-06-01', // after 2020-01-01
      maxDateField: '2020-01-01', // before today
      futureDateField: '2030-01-01', // future
      minAgeField: '2000-01-01', // 24+ years old (>18)
      maxAgeField: '1980-01-01', // 44 years old (<65)
      // Custom
      customField: 'Password1', // 8+ chars, digit, letter
    };
  }

  getInvalidTestData() {
    return {
      // Strings
      requiredField: '', // empty
      emailField: 'invalid-email', // no @
      minLengthField: 'ab', // 2 chars, min is 5
      maxLengthField: 'this is too long', // >10 chars
      patternField: 'abc123', // contains numbers
      urlField: 'not-a-url',
      phoneField: '123', // incomplete
      // Numbers
      minField: 5, // min is 10
      maxField: 150, // max is 100
      numberField: 150, // over 100
      // Dates
      dateField: '2030-01-01', // future date (should be past)
      isDateField: '', // empty
      minDateField: '2019-01-01', // before 2020-01-01
      maxDateField: '2030-01-01', // after today
      futureDateField: '2020-01-01', // past (should be future)
      minAgeField: '2015-01-01', // too young (<18)
      maxAgeField: '1950-01-01', // too old (>65)
      // Custom
      customField: 'pass', // too short, no digit
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  hasNoErrors(): boolean {
    return this.pageErrors.length === 0 && !this.consoleErrors.some((e) => e.includes('Error'));
  }
}
