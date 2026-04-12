import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Behaviors Examples Page
 * Tests reactive behaviors: computeFrom, enableWhen, disableWhen, copyFrom,
 * watchField, transformValue, resetWhen, syncFields, revalidateWhen
 */
export class BehaviorsPage {
  readonly page: Page;
  readonly baseUrl = '/examples/behaviors';

  // Reset button
  readonly resetButton: Locator;

  // Error tracking
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page) {
    this.page = page;

    // Reset button
    this.resetButton = page.getByRole('button', { name: /сбросить форму/i });

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
    await expect(
      this.page.getByRole('heading', { name: /примеры поведений/i })
    ).toBeVisible({ timeout: 10000 });
  }

  // ============================================================================
  // computeFrom: price * quantity = total
  // ============================================================================

  async fillPrice(value: number) {
    await this.input('price').fill(String(value));
  }

  async fillQuantity(value: number) {
    await this.input('quantity').fill(String(value));
  }

  async getTotal(): Promise<number> {
    const value = await this.input('total').inputValue();
    return Number(value) || 0;
  }

  async expectTotal(expected: number) {
    await expect(this.input('total')).toHaveValue(String(expected));
  }

  // ============================================================================
  // enableWhen: country -> city
  // ============================================================================

  async selectCountry(country: 'ru' | 'us' | 'de' | '') {
    await this.input('country').selectOption(country);
  }

  async fillCity(value: string) {
    await this.input('city').fill(value);
  }

  async expectCityEnabled() {
    await expect(this.input('city')).toBeEnabled();
  }

  async expectCityDisabled() {
    await expect(this.input('city')).toBeDisabled();
  }

  async getCityValue(): Promise<string> {
    return await this.input('city').inputValue();
  }

  // ============================================================================
  // enableWhen: hasDiscount -> discountPercent
  // ============================================================================

  async toggleDiscount(enable: boolean) {
    const discountCheckbox = this.input('hasDiscount');
    const isChecked = await discountCheckbox.isChecked();
    if (isChecked !== enable) {
      await discountCheckbox.click();
    }
  }

  async fillDiscountPercent(value: number) {
    await this.input('discountPercent').fill(String(value));
  }

  async expectDiscountFieldVisible() {
    await expect(this.input('discountPercent')).toBeVisible();
  }

  async expectDiscountFieldHidden() {
    await expect(this.input('discountPercent')).not.toBeVisible();
  }

  // ============================================================================
  // disableWhen: isConfirmed -> editableField
  // ============================================================================

  async toggleConfirmed(enable: boolean) {
    const confirmedCheckbox = this.input('isConfirmed');
    const isChecked = await confirmedCheckbox.isChecked();
    if (isChecked !== enable) {
      await confirmedCheckbox.click();
    }
  }

  async fillEditableField(value: string) {
    await this.input('editableField').fill(value);
  }

  async expectEditableFieldEnabled() {
    await expect(this.input('editableField')).toBeEnabled();
  }

  async expectEditableFieldDisabled() {
    await expect(this.input('editableField')).toBeDisabled();
  }

  // ============================================================================
  // copyFrom: shippingAddress -> billingAddress
  // ============================================================================

  async fillShippingAddress(value: string) {
    await this.input('shippingAddress').fill(value);
  }

  async toggleUseShippingAsBilling(enable: boolean) {
    const checkbox = this.input('useShippingAsBilling');
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enable) {
      await checkbox.click();
    }
  }

  async getBillingAddress(): Promise<string> {
    return await this.input('billingAddress').inputValue();
  }

  async expectBillingAddress(expected: string) {
    await expect(this.input('billingAddress')).toHaveValue(expected);
  }

  // ============================================================================
  // transformValue: uppercase
  // ============================================================================

  async fillUppercaseField(value: string) {
    await this.input('uppercaseField').fill(value);
  }

  async expectUppercaseFieldValue(expected: string) {
    await expect(this.input('uppercaseField')).toHaveValue(expected);
  }

  // ============================================================================
  // resetWhen: paymentType -> cardNumber
  // ============================================================================

  async selectPaymentType(type: 'card' | 'cash' | '') {
    await this.input('paymentType').selectOption(type);
  }

  async fillCardNumber(value: string) {
    await this.input('cardNumber').fill(value);
  }

  async expectCardFieldVisible() {
    await expect(this.input('cardNumber')).toBeVisible();
  }

  async expectCardFieldHidden() {
    await expect(this.input('cardNumber')).not.toBeVisible();
  }

  async expectCardResetMessage() {
    await expect(this.page.getByText(/номер карты сброшен/i)).toBeVisible();
  }

  // ============================================================================
  // syncFields: syncField1 <-> syncField2
  // ============================================================================

  async fillSyncField1(value: string) {
    await this.input('syncField1').fill(value);
  }

  async fillSyncField2(value: string) {
    await this.input('syncField2').fill(value);
  }

  async getSyncField1Value(): Promise<string> {
    return await this.input('syncField1').inputValue();
  }

  async getSyncField2Value(): Promise<string> {
    return await this.input('syncField2').inputValue();
  }

  async expectSyncField1Value(expected: string) {
    await expect(this.input('syncField1')).toHaveValue(expected);
  }

  async expectSyncField2Value(expected: string) {
    await expect(this.input('syncField2')).toHaveValue(expected);
  }

  // ============================================================================
  // revalidateWhen: maxAmount -> amount
  // ============================================================================

  async fillMaxAmount(value: number) {
    await this.input('maxAmount').fill(String(value));
  }

  async fillAmount(value: number) {
    await this.input('amount').fill(String(value));
  }

  async expectAmountError(errorText?: string | RegExp) {
    // Find error near amount field
    const amountCard = this.page.locator('text=revalidateWhen').locator('..').locator('..');
    const errorElement = amountCard.locator('.text-red-500, [class*="error"]');
    await expect(errorElement).toBeVisible();

    if (errorText) {
      await expect(errorElement).toHaveText(errorText);
    }
  }

  // ============================================================================
  // Actions
  // ============================================================================

  async reset() {
    await this.resetButton.click();
  }

  async waitForBehaviorUpdate() {
    // Small delay for reactive updates
    await this.page.waitForTimeout(100);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  hasNoErrors(): boolean {
    return this.pageErrors.length === 0 && !this.consoleErrors.some((e) => e.includes('Error'));
  }
}
