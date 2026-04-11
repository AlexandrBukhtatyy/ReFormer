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
    const priceInput = this.page.locator('input[type="number"]').filter({ hasText: '' }).first();
    // Find by label
    const priceField = this.page.getByLabel(/цена/i).first();
    await priceField.fill(String(value));
  }

  async fillQuantity(value: number) {
    const quantityField = this.page.getByLabel(/количество/i).first();
    await quantityField.fill(String(value));
  }

  async getTotal(): Promise<number> {
    const totalField = this.page.getByLabel(/итого/i).first();
    const value = await totalField.inputValue();
    return Number(value) || 0;
  }

  async expectTotal(expected: number) {
    const totalField = this.page.getByLabel(/итого/i).first();
    await expect(totalField).toHaveValue(String(expected));
  }

  // ============================================================================
  // enableWhen: country -> city
  // ============================================================================

  async selectCountry(country: 'ru' | 'us' | 'de' | '') {
    const countrySelect = this.page.getByLabel(/страна/i).first();
    await countrySelect.selectOption(country);
  }

  async fillCity(value: string) {
    const cityField = this.page.getByLabel(/город/i).first();
    await cityField.fill(value);
  }

  async expectCityEnabled() {
    const cityField = this.page.getByLabel(/город/i).first();
    await expect(cityField).toBeEnabled();
  }

  async expectCityDisabled() {
    const cityField = this.page.getByLabel(/город/i).first();
    await expect(cityField).toBeDisabled();
  }

  async getCityValue(): Promise<string> {
    const cityField = this.page.getByLabel(/город/i).first();
    return await cityField.inputValue();
  }

  // ============================================================================
  // enableWhen: hasDiscount -> discountPercent
  // ============================================================================

  async toggleDiscount(enable: boolean) {
    const discountCheckbox = this.page.getByLabel(/применить скидку/i);
    const isChecked = await discountCheckbox.isChecked();
    if (isChecked !== enable) {
      await discountCheckbox.click();
    }
  }

  async fillDiscountPercent(value: number) {
    const discountField = this.page.getByLabel(/процент скидки/i);
    await discountField.fill(String(value));
  }

  async expectDiscountFieldVisible() {
    const discountField = this.page.getByLabel(/процент скидки/i);
    await expect(discountField).toBeVisible();
  }

  async expectDiscountFieldHidden() {
    const discountField = this.page.getByLabel(/процент скидки/i);
    await expect(discountField).not.toBeVisible();
  }

  // ============================================================================
  // disableWhen: isConfirmed -> editableField
  // ============================================================================

  async toggleConfirmed(enable: boolean) {
    const confirmedCheckbox = this.page.getByLabel(/подтвердить/i);
    const isChecked = await confirmedCheckbox.isChecked();
    if (isChecked !== enable) {
      await confirmedCheckbox.click();
    }
  }

  async fillEditableField(value: string) {
    const editableField = this.page.getByLabel(/редактируемое поле/i);
    await editableField.fill(value);
  }

  async expectEditableFieldEnabled() {
    const editableField = this.page.getByLabel(/редактируемое поле/i);
    await expect(editableField).toBeEnabled();
  }

  async expectEditableFieldDisabled() {
    const editableField = this.page.getByLabel(/редактируемое поле/i);
    await expect(editableField).toBeDisabled();
  }

  // ============================================================================
  // copyFrom: shippingAddress -> billingAddress
  // ============================================================================

  async fillShippingAddress(value: string) {
    const shippingField = this.page.getByLabel(/адрес доставки/i);
    await shippingField.fill(value);
  }

  async toggleUseShippingAsBilling(enable: boolean) {
    const checkbox = this.page.getByLabel(/использовать для оплаты/i);
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enable) {
      await checkbox.click();
    }
  }

  async getBillingAddress(): Promise<string> {
    const billingField = this.page.getByLabel(/адрес оплаты/i);
    return await billingField.inputValue();
  }

  async expectBillingAddress(expected: string) {
    const billingField = this.page.getByLabel(/адрес оплаты/i);
    await expect(billingField).toHaveValue(expected);
  }

  // ============================================================================
  // transformValue: uppercase
  // ============================================================================

  async fillUppercaseField(value: string) {
    const uppercaseField = this.page.getByLabel(/код.*uppercase/i);
    await uppercaseField.fill(value);
  }

  async expectUppercaseFieldValue(expected: string) {
    const uppercaseField = this.page.getByLabel(/код.*uppercase/i);
    await expect(uppercaseField).toHaveValue(expected);
  }

  // ============================================================================
  // resetWhen: paymentType -> cardNumber
  // ============================================================================

  async selectPaymentType(type: 'card' | 'cash' | '') {
    const paymentSelect = this.page.getByLabel(/способ оплаты/i);
    await paymentSelect.selectOption(type);
  }

  async fillCardNumber(value: string) {
    const cardField = this.page.getByLabel(/номер карты/i);
    await cardField.fill(value);
  }

  async expectCardFieldVisible() {
    const cardField = this.page.getByLabel(/номер карты/i);
    await expect(cardField).toBeVisible();
  }

  async expectCardFieldHidden() {
    const cardField = this.page.getByLabel(/номер карты/i);
    await expect(cardField).not.toBeVisible();
  }

  async expectCardResetMessage() {
    await expect(this.page.getByText(/номер карты сброшен/i)).toBeVisible();
  }

  // ============================================================================
  // syncFields: syncField1 <-> syncField2
  // ============================================================================

  async fillSyncField1(value: string) {
    const syncField1 = this.page.getByLabel(/поле 1/i).first();
    await syncField1.fill(value);
  }

  async fillSyncField2(value: string) {
    const syncField2 = this.page.getByLabel(/поле 2/i).first();
    await syncField2.fill(value);
  }

  async getSyncField1Value(): Promise<string> {
    const syncField1 = this.page.getByLabel(/поле 1/i).first();
    return await syncField1.inputValue();
  }

  async getSyncField2Value(): Promise<string> {
    const syncField2 = this.page.getByLabel(/поле 2/i).first();
    return await syncField2.inputValue();
  }

  async expectSyncField1Value(expected: string) {
    const syncField1 = this.page.getByLabel(/поле 1/i).first();
    await expect(syncField1).toHaveValue(expected);
  }

  async expectSyncField2Value(expected: string) {
    const syncField2 = this.page.getByLabel(/поле 2/i).first();
    await expect(syncField2).toHaveValue(expected);
  }

  // ============================================================================
  // revalidateWhen: maxAmount -> amount
  // ============================================================================

  async fillMaxAmount(value: number) {
    const maxAmountField = this.page.getByLabel(/макс\. сумма/i);
    await maxAmountField.fill(String(value));
  }

  async fillAmount(value: number) {
    const amountField = this.page.getByLabel(/сумма/i).last();
    await amountField.fill(String(value));
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
