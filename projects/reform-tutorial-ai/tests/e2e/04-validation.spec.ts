import { test, expect } from '@playwright/test';

test.describe('04 - Validation', () => {
  test.describe('Step 1: Loan Info Validation', () => {
    test('shows required error for empty loan type', async ({ page }) => {
      await page.goto('/');

      // Navigate away and back to trigger validation
      await page.click('button:has-text("Next")');

      // Check for error message
      const loanTypeError = page.locator('[data-testid="error-loanType"]');
      await expect(loanTypeError).toBeVisible();
      await expect(loanTypeError).toContainText('Please select a loan type');
    });

    test('validates loan amount min/max', async ({ page }) => {
      await page.goto('/');

      // Select loan type first
      await page.selectOption('[data-testid="input-loanType"]', 'consumer');

      // Enter too small amount
      await page.fill('[data-testid="input-loanAmount"]', '100');
      await page.click('[data-testid="input-loanTerm"]'); // blur to trigger validation

      const loanAmountError = page.locator('[data-testid="error-loanAmount"]');
      await expect(loanAmountError).toBeVisible();
      await expect(loanAmountError).toContainText('Minimum loan amount is 10,000');
    });

    test('validates loan term range', async ({ page }) => {
      await page.goto('/');

      await page.selectOption('[data-testid="input-loanType"]', 'consumer');
      await page.fill('[data-testid="input-loanTerm"]', '2');
      await page.click('[data-testid="input-loanAmount"]'); // blur

      const loanTermError = page.locator('[data-testid="error-loanTerm"]');
      await expect(loanTermError).toBeVisible();
      await expect(loanTermError).toContainText('Minimum loan term is 6 months');
    });

    test('mortgage fields are validated when mortgage selected', async ({ page }) => {
      await page.goto('/');

      await page.selectOption('[data-testid="input-loanType"]', 'mortgage');
      await page.fill('[data-testid="input-loanAmount"]', '1000000');
      await page.fill('[data-testid="input-loanTerm"]', '120');
      await page.fill('[data-testid="input-loanPurpose"]', 'Home purchase');

      // Click Next to trigger validation
      await page.click('button:has-text("Next")');

      // Should show property value error
      const propertyValueError = page.locator('[data-testid="error-propertyValue"]');
      await expect(propertyValueError).toBeVisible();
    });

    test('validates initial payment must be at least 10% of property value', async ({ page }) => {
      await page.goto('/');

      await page.selectOption('[data-testid="input-loanType"]', 'mortgage');
      await page.fill('[data-testid="input-propertyValue"]', '10000000');
      await page.fill('[data-testid="input-initialPayment"]', '500000'); // 5%, should fail
      await page.click('[data-testid="input-loanAmount"]'); // blur

      const initialPaymentError = page.locator('[data-testid="error-initialPayment"]');
      await expect(initialPaymentError).toBeVisible();
      await expect(initialPaymentError).toContainText('at least 10%');
    });
  });

  test.describe('Step 2: Personal Info Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      // Fill step 1 to enable navigation
      await page.selectOption('[data-testid="input-loanType"]', 'consumer');
      await page.fill('[data-testid="input-loanAmount"]', '100000');
      await page.fill('[data-testid="input-loanTerm"]', '12');
      await page.fill('[data-testid="input-loanPurpose"]', 'Personal expenses');
      await page.click('button:has-text("Next")');
    });

    test('validates required personal data fields', async ({ page }) => {
      // Click Next without filling fields
      await page.click('button:has-text("Next")');

      // Should show required errors
      await expect(page.locator('[data-testid="error-personalData.lastName"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-personalData.firstName"]')).toBeVisible();
    });

    test('validates passport format', async ({ page }) => {
      // Fill passport with invalid format
      await page.fill('[data-testid="input-passportData.series"]', '12');
      await page.click('[data-testid="input-passportData.number"]');

      const seriesError = page.locator('[data-testid="error-passportData.series"]');
      await expect(seriesError).toBeVisible();
      await expect(seriesError).toContainText('4 digits');
    });

    test('validates INN format', async ({ page }) => {
      await page.fill('[data-testid="input-inn"]', '123');
      await page.click('[data-testid="input-snils"]');

      const innError = page.locator('[data-testid="error-inn"]');
      await expect(innError).toBeVisible();
      await expect(innError).toContainText('12 digits');
    });

    test('validates age requirement (18-70)', async ({ page }) => {
      // Calculate a birth date that makes person 16 years old
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
      const birthDateStr = birthDate.toISOString().split('T')[0];

      await page.fill('[data-testid="input-personalData.birthDate"]', birthDateStr);
      await page.click('[data-testid="input-personalData.lastName"]');

      const birthDateError = page.locator('[data-testid="error-personalData.birthDate"]');
      await expect(birthDateError).toBeVisible();
      await expect(birthDateError).toContainText('at least 18 years');
    });
  });

  test.describe('Step 3: Contact Info Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      // Navigate to step 3
      await page.selectOption('[data-testid="input-loanType"]', 'consumer');
      await page.fill('[data-testid="input-loanAmount"]', '100000');
      await page.fill('[data-testid="input-loanTerm"]', '12');
      await page.fill('[data-testid="input-loanPurpose"]', 'Personal');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
    });

    test('validates phone format', async ({ page }) => {
      await page.fill('[data-testid="input-phoneMain"]', '123456');
      await page.click('[data-testid="input-email"]');

      const phoneError = page.locator('[data-testid="error-phoneMain"]');
      await expect(phoneError).toBeVisible();
      await expect(phoneError).toContainText('+7XXXXXXXXXX');
    });

    test('validates email format', async ({ page }) => {
      await page.fill('[data-testid="input-email"]', 'invalid-email');
      await page.click('[data-testid="input-phoneMain"]');

      const emailError = page.locator('[data-testid="error-email"]');
      await expect(emailError).toBeVisible();
      await expect(emailError).toContainText('valid email');
    });

    test('validates postal code format', async ({ page }) => {
      await page.fill('[data-testid="input-registrationAddress.postalCode"]', '12345');
      await page.click('[data-testid="input-registrationAddress.city"]');

      const postalError = page.locator('[data-testid="error-registrationAddress.postalCode"]');
      await expect(postalError).toBeVisible();
      await expect(postalError).toContainText('6 digits');
    });
  });

  test.describe('Step 4: Employment Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      // Navigate to step 4
      await page.selectOption('[data-testid="input-loanType"]', 'consumer');
      await page.fill('[data-testid="input-loanAmount"]', '100000');
      await page.fill('[data-testid="input-loanTerm"]', '12');
      await page.fill('[data-testid="input-loanPurpose"]', 'Personal');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
      await page.click('button:has-text("Next")');
    });

    test('validates required employment status', async ({ page }) => {
      await page.click('button:has-text("Next")');

      const statusError = page.locator('[data-testid="error-employmentStatus"]');
      await expect(statusError).toBeVisible();
      await expect(statusError).toContainText('Please select employment status');
    });

    test('validates company info when employed', async ({ page }) => {
      await page.selectOption('[data-testid="input-employmentStatus"]', 'employed');
      await page.click('button:has-text("Next")');

      await expect(page.locator('[data-testid="error-companyName"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-companyInn"]')).toBeVisible();
    });

    test('validates company INN format', async ({ page }) => {
      await page.selectOption('[data-testid="input-employmentStatus"]', 'employed');
      await page.fill('[data-testid="input-companyInn"]', '12345');
      await page.click('[data-testid="input-companyName"]');

      const innError = page.locator('[data-testid="error-companyInn"]');
      await expect(innError).toBeVisible();
      await expect(innError).toContainText('10 digits');
    });

    test('validates current experience cannot exceed total', async ({ page }) => {
      await page.selectOption('[data-testid="input-employmentStatus"]', 'employed');
      await page.fill('[data-testid="input-workExperienceTotal"]', '5');
      await page.fill('[data-testid="input-workExperienceCurrent"]', '10');
      await page.click('[data-testid="input-companyName"]');

      const experienceError = page.locator('[data-testid="error-workExperienceCurrent"]');
      await expect(experienceError).toBeVisible();
      await expect(experienceError).toContainText('cannot exceed total');
    });
  });

  test.describe('Step 6: Confirmation Validation', () => {
    test('validates required agreements', async ({ page }) => {
      await page.goto('/');
      // Navigate to step 6
      await page.click('[data-testid="step-6"]');

      // Try to submit without checking agreements
      await page.click('button:has-text("Submit")');

      await expect(page.locator('[data-testid="error-agreePersonalData"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-agreeCreditHistory"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-agreeTerms"]')).toBeVisible();
    });

    test('validates electronic signature required', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-testid="step-6"]');

      // Check required agreements
      await page.click('[data-testid="input-agreePersonalData"]');
      await page.click('[data-testid="input-agreeCreditHistory"]');
      await page.click('[data-testid="input-agreeTerms"]');
      await page.click('[data-testid="input-confirmAccuracy"]');

      await page.click('button:has-text("Submit")');

      const signatureError = page.locator('[data-testid="error-electronicSignature"]');
      await expect(signatureError).toBeVisible();
    });
  });

  test.describe('Cross-field Validation', () => {
    test('validates payment to income ratio', async ({ page }) => {
      await page.goto('/');

      // This test would require setting up income and loan amount
      // to verify the 50% payment-to-income ratio validation
      // Implementation depends on computed fields working correctly
    });
  });
});
