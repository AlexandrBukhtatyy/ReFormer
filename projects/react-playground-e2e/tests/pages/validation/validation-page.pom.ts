import { type Page, type Locator, expect } from '@playwright/test';
import type { PerformanceCollector } from '../../shared/performance-collector';

export interface ValidationPageOptions {
  perf?: PerformanceCollector;
}

/**
 * Page Object Model for Validation Examples Page
 * Tests built-in validators: required, email, minLength, maxLength, pattern, url, phone,
 * min, max, number, date validators, and custom validators
 */
export class ValidationPage {
  readonly page: Page;
  readonly baseUrl = '/examples/validation';
  readonly perf?: PerformanceCollector;

  // Control buttons
  readonly validateAllButton: Locator;
  readonly resetButton: Locator;

  // Error tracking
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page, options?: ValidationPageOptions) {
    this.page = page;
    this.perf = options?.perf;

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

  private async measure<T>(name: string, action: () => Promise<T>): Promise<T> {
    return this.perf ? this.perf.measure(name, action) : action();
  }

  async goto() {
    return this.measure('goto', async () => {
      await this.page.goto(this.baseUrl);
      await this.page.waitForLoadState('networkidle');
      await this.waitForPageReady();
    });
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
    return this.measure('validateAll', async () => {
      await this.validateAllButton.click();
    });
  }

  async reset() {
    return this.measure('reset', async () => {
      await this.resetButton.click();
    });
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
  // Utilities
  // ============================================================================

  hasNoErrors(): boolean {
    return this.pageErrors.length === 0 && !this.consoleErrors.some((e) => e.includes('Error'));
  }
}
