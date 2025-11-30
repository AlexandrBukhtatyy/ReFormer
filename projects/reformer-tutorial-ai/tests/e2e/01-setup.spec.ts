import { test, expect } from '@playwright/test';

test.describe('01 - Setup', () => {
  test('project starts and renders correctly', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads
    await expect(page).toHaveTitle(/Credit Application Form/);

    // Check that our heading is visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Credit Application Form');
  });
});

test.describe('02 - Rendering', () => {
  test('form renders with step navigation', async ({ page }) => {
    await page.goto('/');

    // Check that step indicators are visible
    const stepButtons = page.locator('button:has-text("Loan Info")');
    await expect(stepButtons).toBeVisible();

    // Check that first step content is visible
    const stepTitle = page.locator('h2');
    await expect(stepTitle).toHaveText('Basic Loan Information');

    // Check navigation buttons
    const previousButton = page.locator('button:has-text("Previous")');
    const nextButton = page.locator('button:has-text("Next")');
    await expect(previousButton).toBeDisabled();
    await expect(nextButton).toBeEnabled();
  });

  test('can navigate between steps', async ({ page }) => {
    await page.goto('/');

    // Go to step 2
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2')).toHaveText('Personal Information');

    // Go to step 3
    await page.click('button:has-text("Next")');
    await expect(page.locator('h2')).toHaveText('Contact Information');

    // Go back to step 2
    await page.click('button:has-text("Previous")');
    await expect(page.locator('h2')).toHaveText('Personal Information');

    // Click directly on step 4
    await page.click('button:has-text("4. Employment")');
    await expect(page.locator('h2')).toHaveText('Employment Information');
  });

  test('form fields render on step 1', async ({ page }) => {
    await page.goto('/');

    // Check that form fields are visible
    await expect(page.locator('label:has-text("Loan Type")')).toBeVisible();
    await expect(page.locator('label:has-text("Loan Amount")')).toBeVisible();
    await expect(page.locator('label:has-text("Loan Term")')).toBeVisible();
    await expect(page.locator('label:has-text("Loan Purpose")')).toBeVisible();
  });

  test('conditional fields appear for mortgage', async ({ page }) => {
    await page.goto('/');

    // Initially mortgage fields should not be visible
    await expect(page.locator('text=Property Information')).not.toBeVisible();

    // Select mortgage loan type
    await page.click('[data-slot="select-trigger"]');
    await page.click('text=Mortgage');

    // Now property fields should be visible
    await expect(page.locator('text=Property Information')).toBeVisible();
    await expect(page.locator('label:has-text("Property Value")')).toBeVisible();
    await expect(page.locator('label:has-text("Initial Payment")')).toBeVisible();
  });

  test('confirmation step shows all checkboxes', async ({ page }) => {
    await page.goto('/');

    // Navigate to confirmation step (step 6)
    await page.click('button:has-text("6. Confirmation")');

    // Check that confirmation checkboxes are visible
    await expect(page.locator('h2')).toHaveText('Confirmation');
    await expect(page.locator('text=I agree to processing of personal data')).toBeVisible();
    await expect(page.locator('text=I agree to credit history check')).toBeVisible();
    await expect(page.locator('text=I agree to loan terms')).toBeVisible();

    // Check that submit button is visible on last step
    await expect(page.locator('button:has-text("Submit Application")')).toBeVisible();
  });
});
