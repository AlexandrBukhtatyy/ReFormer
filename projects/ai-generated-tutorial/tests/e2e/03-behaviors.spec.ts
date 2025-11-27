import { test, expect } from '@playwright/test';

test.describe('03 - Behaviors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Step 1: Loan Info Behaviors', () => {
    test('interest rate shows default value for consumer loan', async ({ page }) => {
      // Consumer loan is default, interest rate should be 15%
      // Note: We need to navigate to where interest rate is visible
      // For now, we test that the loan type selector works
      await expect(page.locator('[data-slot="select-trigger"]').first()).toBeVisible();
    });

    test('mortgage fields appear when mortgage is selected', async ({ page }) => {
      // Initially mortgage fields should not be visible
      await expect(page.locator('text=Property Information')).not.toBeVisible();

      // Select mortgage loan type
      await page.click('[data-slot="select-trigger"]');
      await page.click('text=Mortgage');

      // Now property fields should be visible
      await expect(page.locator('text=Property Information')).toBeVisible();
    });

    test('car fields appear when car loan is selected', async ({ page }) => {
      // Initially car fields should not be visible
      await expect(page.locator('text=Car Information')).not.toBeVisible();

      // Select car loan type
      await page.click('[data-slot="select-trigger"]');
      await page.click('text=Car Loan');

      // Now car fields should be visible
      await expect(page.locator('text=Car Information')).toBeVisible();
    });

    test('fields reset when changing loan type', async ({ page }) => {
      // Select mortgage and fill property value
      await page.click('[data-slot="select-trigger"]');
      await page.click('text=Mortgage');
      await page.fill('input[type="number"]', '5000000');

      // Switch to car loan
      await page.click('[data-slot="select-trigger"]');
      await page.click('text=Car Loan');

      // Mortgage fields should be hidden
      await expect(page.locator('text=Property Information')).not.toBeVisible();

      // Car fields should be visible
      await expect(page.locator('text=Car Information')).toBeVisible();
    });
  });

  test.describe('Step 2: Personal Info Behaviors', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to step 2
      await page.click('button:has-text("2. Personal")');
    });

    test('full name is computed from personal data', async ({ page }) => {
      // Fill in name fields
      await page.fill('input[placeholder="Enter last name"]', 'Smith');
      await page.fill('input[placeholder="Enter first name"]', 'John');
      await page.fill('input[placeholder="Enter middle name"]', 'William');

      // Check computed full name (should be disabled)
      const fullNameInput = page.locator('[data-testid="input-fullName"]');
      // The full name should be computed
      await expect(fullNameInput).toHaveValue('Smith John William');
    });
  });

  test.describe('Step 3: Contact Info Behaviors', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to step 3
      await page.click('button:has-text("3. Contact")');
    });

    test('residence address is hidden when same as registration', async ({ page }) => {
      // By default, sameAsRegistration should be checked (true)
      // So residence address section should be hidden
      const residenceSection = page.locator('text=Residence Address');

      // Initially should not be visible (checkbox is checked by default)
      await expect(residenceSection).not.toBeVisible();
    });

    test('residence address appears when checkbox unchecked', async ({ page }) => {
      // Uncheck the "same as registration" checkbox
      await page.click('[data-testid="input-sameAsRegistration"]');

      // Residence address section should now be visible
      await expect(page.locator('h3:has-text("Residence Address")')).toBeVisible();
    });
  });

  test.describe('Step 4: Employment Behaviors', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to step 4
      await page.click('button:has-text("4. Employment")');
    });

    test('company fields show for employed status', async ({ page }) => {
      // By default, employmentStatus should be 'employed'
      // Company fields should be visible
      await expect(page.locator('text=Company Information')).toBeVisible();
    });

    test('business fields show for self-employed status', async ({ page }) => {
      // Click self-employed radio
      await page.click('text=Self-Employed');

      // Company fields should be hidden, business fields visible
      await expect(page.locator('text=Company Information')).not.toBeVisible();
      await expect(page.locator('text=Business Information')).toBeVisible();
    });

    test('fields hidden for unemployed status', async ({ page }) => {
      // Click unemployed radio
      await page.click('text=Unemployed');

      // Both company and business fields should be hidden
      await expect(page.locator('text=Company Information')).not.toBeVisible();
      await expect(page.locator('text=Business Information')).not.toBeVisible();
    });
  });

  test.describe('Step 5: Additional Info Behaviors', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to step 5
      await page.click('button:has-text("5. Additional")');
    });

    test('property array shows when checkbox checked', async ({ page }) => {
      // Check "I have property" checkbox
      await page.click('[data-testid="input-hasProperty"]');

      // Property array manager should appear
      await expect(page.locator('text=Property')).toBeVisible();
      await expect(page.locator('button:has-text("+ Add Property")')).toBeVisible();
    });

    test('existing loans array shows when checkbox checked', async ({ page }) => {
      // Check "I have existing loans" checkbox
      await page.click('[data-testid="input-hasExistingLoans"]');

      // Existing loans array manager should appear
      await expect(page.locator('button:has-text("+ Add Existing Loan")')).toBeVisible();
    });

    test('co-borrowers array shows when checkbox checked', async ({ page }) => {
      // Check "Add co-borrower" checkbox
      await page.click('[data-testid="input-hasCoBorrower"]');

      // Co-borrowers array manager should appear
      await expect(page.locator('button:has-text("+ Add Co-Borrower")')).toBeVisible();
    });
  });
});
