import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model with common functionality
 * - Error tracking (console errors, page errors)
 * - Common selectors: field(testId), input(testId), label(testId), error(testId)
 * - A11y helpers (preparation for axe)
 * - Methods hasNoErrors(), hasNoStackOverflow()
 */
export class BasePage {
  readonly page: Page;

  // Error tracking
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];
  readonly consoleWarnings: string[] = [];

  constructor(page: Page) {
    this.page = page;
    this.setupErrorTracking();
  }

  // ============================================================================
  // Error Tracking
  // ============================================================================

  /**
   * Setup error tracking for console and page errors
   */
  private setupErrorTracking(): void {
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        this.consoleWarnings.push(msg.text());
      }
    });

    this.page.on('pageerror', (error) => {
      this.pageErrors.push(error.message);
    });
  }

  /**
   * Clear tracked errors (useful before specific action testing)
   */
  clearErrors(): void {
    this.consoleErrors.length = 0;
    this.pageErrors.length = 0;
    this.consoleWarnings.length = 0;
  }

  /**
   * Check if there are no critical errors
   */
  hasNoErrors(): boolean {
    return this.pageErrors.length === 0 && !this.consoleErrors.some((e) => e.includes('Error'));
  }

  /**
   * Check for Maximum call stack size exceeded errors
   */
  hasNoStackOverflow(): boolean {
    return !this.pageErrors.some((e) => e.includes('Maximum call stack size exceeded'));
  }

  /**
   * Check for React-specific errors
   */
  hasNoReactErrors(): boolean {
    const reactErrorPatterns = [
      'Maximum update depth exceeded',
      'Cannot update a component',
      'Each child in a list should have a unique',
      'Invalid hook call',
    ];
    return !this.consoleErrors.some((e) =>
      reactErrorPatterns.some((pattern) => e.includes(pattern))
    );
  }

  /**
   * Get all errors as a formatted string for debugging
   */
  getErrorsSummary(): string {
    const errors: string[] = [];
    if (this.pageErrors.length > 0) {
      errors.push(`Page errors:\n  ${this.pageErrors.join('\n  ')}`);
    }
    if (this.consoleErrors.length > 0) {
      errors.push(`Console errors:\n  ${this.consoleErrors.join('\n  ')}`);
    }
    return errors.length > 0 ? errors.join('\n\n') : 'No errors';
  }

  /**
   * Assert no errors occurred (throws if errors found)
   */
  async assertNoErrors(): Promise<void> {
    if (!this.hasNoErrors()) {
      throw new Error(`Unexpected errors found:\n${this.getErrorsSummary()}`);
    }
  }

  // ============================================================================
  // Common Selectors by data-testid
  // ============================================================================

  /**
   * Get field container by testid
   * @param testId - The test ID without prefix (e.g., 'email' for 'field-email')
   */
  field(testId: string): Locator {
    return this.page.locator(`[data-testid="field-${testId}"]`);
  }

  /**
   * Get input element by testid
   * @param testId - The test ID without prefix (e.g., 'email' for 'input-email')
   */
  input(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}"]`);
  }

  /**
   * Get label element by testid
   * @param testId - The test ID without prefix (e.g., 'email' for 'label-email')
   */
  label(testId: string): Locator {
    return this.page.locator(`[data-testid="label-${testId}"]`);
  }

  /**
   * Get error message element by testid
   * @param testId - The test ID without prefix (e.g., 'email' for 'error-email')
   */
  error(testId: string): Locator {
    return this.page.locator(`[data-testid="error-${testId}"]`);
  }

  /**
   * Get element by any data-testid
   */
  byTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  // ============================================================================
  // Common Assertions
  // ============================================================================

  /**
   * Assert field is visible
   */
  async expectFieldVisible(fieldTestId: string): Promise<void> {
    await expect(this.field(fieldTestId)).toBeVisible();
  }

  /**
   * Assert field is hidden
   */
  async expectFieldHidden(fieldTestId: string): Promise<void> {
    await expect(this.field(fieldTestId)).not.toBeVisible();
  }

  /**
   * Assert field has error message
   */
  async expectFieldError(fieldTestId: string, errorText?: string | RegExp): Promise<void> {
    const errorElement = this.error(fieldTestId);
    await expect(errorElement).toBeVisible();

    if (errorText) {
      await expect(errorElement).toHaveText(errorText);
    }
  }

  /**
   * Assert field has no error
   */
  async expectNoFieldError(fieldTestId: string): Promise<void> {
    const errorElement = this.error(fieldTestId);
    await expect(errorElement).not.toBeVisible();
  }

  /**
   * Assert input has specific value
   */
  async expectFieldValue(fieldTestId: string, value: string): Promise<void> {
    await expect(this.input(fieldTestId)).toHaveValue(value);
  }

  /**
   * Assert input is disabled
   */
  async expectFieldDisabled(fieldTestId: string): Promise<void> {
    await expect(this.input(fieldTestId)).toBeDisabled();
  }

  /**
   * Assert input is enabled
   */
  async expectFieldEnabled(fieldTestId: string): Promise<void> {
    await expect(this.input(fieldTestId)).toBeEnabled();
  }

  // ============================================================================
  // A11y Helpers (Preparation for axe)
  // ============================================================================

  /**
   * Check if element has accessible name
   */
  async hasAccessibleName(locator: Locator): Promise<boolean> {
    const accessibleName = await locator.getAttribute('aria-label');
    const labelledBy = await locator.getAttribute('aria-labelledby');
    const id = await locator.getAttribute('id');

    if (accessibleName || labelledBy) {
      return true;
    }

    // Check for associated label
    if (id) {
      const label = this.page.locator(`label[for="${id}"]`);
      return (await label.count()) > 0;
    }

    return false;
  }

  /**
   * Get all focusable elements on the page
   */
  async getFocusableElements(): Promise<Locator> {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return this.page.locator(focusableSelectors);
  }

  /**
   * Check keyboard navigation works (Tab key)
   */
  async checkTabNavigation(expectedOrder: string[]): Promise<void> {
    for (const testId of expectedOrder) {
      await this.page.keyboard.press('Tab');
      const focused = this.page.locator(':focus');
      const focusedTestId = await focused.getAttribute('data-testid');
      expect(focusedTestId).toBe(testId);
    }
  }

  /**
   * Check if element has proper ARIA role
   */
  async hasRole(locator: Locator, role: string): Promise<boolean> {
    const elementRole = await locator.getAttribute('role');
    return elementRole === role;
  }

  // ============================================================================
  // Common Navigation Helpers
  // ============================================================================

  /**
   * Navigate to a URL and wait for network idle
   */
  async navigateTo(url: string): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for element to be stable (no animations)
   */
  async waitForStable(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    // Wait a bit for animations to complete
    await this.page.waitForTimeout(100);
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }
}
