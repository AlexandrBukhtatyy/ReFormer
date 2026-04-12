import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Registration Form
 * Uses data-testid selectors for test stability
 */
export class SimpleFormPage {
  readonly page: Page;
  readonly baseUrl = '/examples/simple';

  // Form fields
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly fullNameInput: Locator;
  readonly phoneInput: Locator;
  readonly captchaInput: Locator;
  readonly acceptTermsCheckbox: Locator;

  // Buttons
  readonly submitButton: Locator;
  readonly resetButton: Locator;

  // Error tracking
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page) {
    this.page = page;

    // Form field locators
    this.usernameInput = page.locator('[data-testid="input-username"]');
    this.emailInput = page.locator('[data-testid="input-email"]');
    this.passwordInput = page.locator('[data-testid="input-password"]');
    this.confirmPasswordInput = page.locator('[data-testid="input-confirmPassword"]');
    this.fullNameInput = page.locator('[data-testid="input-fullName"]');
    this.phoneInput = page.locator('[data-testid="input-phone"]');
    this.captchaInput = page.locator('[data-testid="input-captcha"]');
    this.acceptTermsCheckbox = page.locator('[data-testid="input-acceptTerms"]');

    // Button locators
    this.submitButton = page.getByRole('button', { name: /зарегистрироваться/i });
    this.resetButton = page.getByRole('button', { name: /очистить/i });

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
    await this.waitForFormReady();
  }

  async waitForFormReady() {
    await expect(this.page.getByRole('heading', { name: /регистрация/i })).toBeVisible({
      timeout: 10000,
    });
  }

  // ============================================================================
  // Form Field Actions
  // ============================================================================

  async fillUsername(username: string) {
    await this.usernameInput.fill(username);
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async fillConfirmPassword(password: string) {
    await this.confirmPasswordInput.fill(password);
  }

  async fillFullName(fullName: string) {
    await this.fullNameInput.fill(fullName);
  }

  async fillPhone(phone: string) {
    await this.phoneInput.fill(phone);
  }

  async fillCaptcha(captcha: string) {
    await this.captchaInput.fill(captcha);
  }

  async acceptTerms() {
    await this.acceptTermsCheckbox.check();
  }

  async submit() {
    await this.submitButton.click();
  }

  async reset() {
    await this.resetButton.click();
  }

  // ============================================================================
  // Fill Complete Form
  // ============================================================================

  async fillValidForm(options?: {
    username?: string;
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    captcha?: string;
  }) {
    await this.fillUsername(options?.username ?? 'testuser123');
    await this.fillEmail(options?.email ?? 'test@example.com');
    await this.fillPassword(options?.password ?? 'Password123');
    await this.fillConfirmPassword(options?.password ?? 'Password123');
    await this.fillFullName(options?.fullName ?? 'Test User');
    await this.fillPhone(options?.phone ?? '+7 (999) 123-45-67');
    await this.fillCaptcha(options?.captcha ?? 'ABC123');
    await this.acceptTerms();
  }

  // ============================================================================
  // Wait for Async Validation
  // ============================================================================

  async waitForAsyncValidation() {
    // Wait for async validation debounce + network request
    await this.page.waitForTimeout(1000);
    // Wait for "Checking..." text to disappear
    await this.page
      .waitForSelector('text=Проверка...', { state: 'hidden', timeout: 5000 })
      .catch(() => {});
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

  async expectFormValid() {
    await expect(this.submitButton).toBeEnabled();
  }

  async expectFormInvalid() {
    await expect(this.submitButton).toBeDisabled();
  }

  async expectSuccessAlert() {
    // Dialog handling is done in the test
    // This method can be used to verify form reset after success
    await expect(this.usernameInput).toHaveValue('');
  }

  async expectPendingState() {
    await expect(this.submitButton).toHaveText(/проверка/i);
  }

  // ============================================================================
  // Phone Mask Helpers
  // ============================================================================

  async typePhoneWithMask(digits: string) {
    // Type only digits, mask should format automatically
    await this.phoneInput.click();
    await this.phoneInput.fill('');
    for (const digit of digits) {
      await this.page.keyboard.type(digit);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  hasNoErrors(): boolean {
    return this.pageErrors.length === 0 && !this.consoleErrors.some((e) => e.includes('Error'));
  }
}
