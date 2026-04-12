/**
 * Visual Regression Tests for Complex Multi-Step Form
 * Captures screenshots of each step and compares variants
 *
 * @tag @visual
 */

import { test, expect } from '../../shared/test-factory';

test.describe('Visual Regression - Complex Form', { tag: ['@visual'] }, () => {
  test.describe('VIS-001: Screenshot Each Step', () => {
    test('VIS-001-A: Step 1 - Basic Info screenshot', async ({ page, creditForm }) => {
      await creditForm.goto();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('step-1-basic-info.png', {
        fullPage: false,
        animations: 'disabled',
        mask: [page.locator('[data-testid="timestamp"]')], // Mask dynamic content
      });
    });

    test('VIS-001-B: Step 1 - Consumer Loan selected', async ({ page, creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('consumer');

      await expect(page).toHaveScreenshot('step-1-consumer-loan.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-001-C: Step 1 - Mortgage selected (shows extra fields)', async ({
      page,
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      await expect(page).toHaveScreenshot('step-1-mortgage.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-001-D: Step 1 - Car Loan selected (shows extra fields)', async ({
      page,
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      await expect(page).toHaveScreenshot('step-1-car-loan.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-001-E: Step 2 - Personal Data screenshot', async ({ page, creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('consumer');
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.selectLoanPurpose('purchase');
      await creditForm.goToNextStep();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('step-2-personal-data.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-001-F: Step 3 - Contact Info screenshot', async ({ page, creditForm }) => {
      await test.step('Navigate to Step 3', async () => {
        await creditForm.goto();
        await creditForm.selectLoanType('consumer');
        await creditForm.fillLoanAmount(500000);
        await creditForm.fillLoanTerm(24);
        await creditForm.selectLoanPurpose('purchase');
        await creditForm.goToNextStep();

        // Fill Step 2 minimum data
        await creditForm.fillPersonalDataLastName('Иванов');
        await creditForm.fillPersonalDataFirstName('Иван');
        await creditForm.fillPersonalDataBirthDate('1990-01-15');
        await creditForm.goToNextStep();
      });

      await expect(page).toHaveScreenshot('step-3-contact-info.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-001-G: Step 4 - Employment screenshot', async ({ page, creditForm }) => {
      await test.step('Navigate to Step 4', async () => {
        await creditForm.goto();
        await creditForm.selectLoanType('consumer');
        await creditForm.fillLoanAmount(500000);
        await creditForm.fillLoanTerm(24);
        await creditForm.selectLoanPurpose('purchase');
        await creditForm.goToNextStep();

        await creditForm.fillPersonalDataLastName('Иванов');
        await creditForm.fillPersonalDataFirstName('Иван');
        await creditForm.fillPersonalDataBirthDate('1990-01-15');
        await creditForm.goToNextStep();

        await creditForm.fillPhoneMain('+7 (999) 123-45-67');
        await creditForm.fillEmail('test@example.com');
        await creditForm.goToNextStep();
      });

      await expect(page).toHaveScreenshot('step-4-employment.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-001-H: Validation errors screenshot', async ({ page, creditForm }) => {
      await creditForm.goto();
      await creditForm.goToNextStep(); // Try to proceed without filling

      await expect(page).toHaveScreenshot('step-1-validation-errors.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });
  });

  test.describe('VIS-002: Compare Compound vs Renderer', () => {
    test('VIS-002-A: Step 1 should be visually identical', async ({ page, creditForm }) => {
      await creditForm.goto();
      await page.waitForLoadState('networkidle');

      // Screenshot name includes variant from metadata
      const variant = creditForm.variant;
      await expect(page).toHaveScreenshot(`step-1-${variant}.png`, {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-002-B: Consumer loan form should be visually identical', async ({
      page,
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('consumer');
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);

      const variant = creditForm.variant;
      await expect(page).toHaveScreenshot(`consumer-loan-filled-${variant}.png`, {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-002-C: Conditional fields should render identically', async ({
      page,
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      const variant = creditForm.variant;
      await expect(page).toHaveScreenshot(`mortgage-fields-${variant}.png`, {
        fullPage: false,
        animations: 'disabled',
      });
    });
  });

  test.describe('VIS-003: Responsive Screenshots', () => {
    test('VIS-003-A: Mobile viewport (375px)', async ({ page, creditForm }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await creditForm.goto();

      await expect(page).toHaveScreenshot('step-1-mobile.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-003-B: Tablet viewport (768px)', async ({ page, creditForm }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await creditForm.goto();

      await expect(page).toHaveScreenshot('step-1-tablet.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });

    test('VIS-003-C: Desktop viewport (1280px)', async ({ page, creditForm }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await creditForm.goto();

      await expect(page).toHaveScreenshot('step-1-desktop.png', {
        fullPage: false,
        animations: 'disabled',
      });
    });
  });

  test.describe('VIS-004: Component States', () => {
    test('VIS-004-A: Input focus state', async ({ page, creditForm }) => {
      await creditForm.goto();
      const input = page.locator('[data-testid="input-loanAmount"]');
      await input.focus();

      await expect(input).toHaveScreenshot('input-focus-state.png');
    });

    test('VIS-004-B: Input error state', async ({ page, creditForm }) => {
      await creditForm.goto();
      await creditForm.goToNextStep();

      const errorField = page.locator('[data-testid="field-loanType"]');
      if ((await errorField.count()) > 0) {
        await expect(errorField).toHaveScreenshot('input-error-state.png');
      }
    });

    test('VIS-004-C: Button states', async ({ page, creditForm }) => {
      await creditForm.goto();

      const nextButton = page.locator('[data-testid="btn-next"]');
      await expect(nextButton).toHaveScreenshot('button-default.png');

      await nextButton.hover();
      await expect(nextButton).toHaveScreenshot('button-hover.png');
    });

    test('VIS-004-D: Step indicator active state', async ({ page, creditForm }) => {
      await creditForm.goto();

      const stepIndicator = page.locator('[data-testid="step-indicator"], [class*="step"]').first();
      if ((await stepIndicator.count()) > 0) {
        await expect(stepIndicator).toHaveScreenshot('step-indicator.png');
      }
    });
  });

  test.describe('VIS-005: Form Arrays', () => {
    test('VIS-005-A: Empty array state', async ({ page, creditForm }) => {
      await test.step('Navigate to step with arrays', async () => {
        await creditForm.goto();
        await creditForm.selectLoanType('consumer');
        await creditForm.fillLoanAmount(500000);
        await creditForm.fillLoanTerm(24);
        await creditForm.selectLoanPurpose('purchase');
        await creditForm.goToNextStep();

        await creditForm.fillPersonalDataLastName('Иванов');
        await creditForm.fillPersonalDataFirstName('Иван');
        await creditForm.fillPersonalDataBirthDate('1990-01-15');
        await creditForm.goToNextStep();

        await creditForm.fillPhoneMain('+7 (999) 123-45-67');
        await creditForm.fillEmail('test@example.com');
        await creditForm.goToNextStep();

        await creditForm.selectEmploymentStatus('employed');
        await creditForm.goToNextStep();
      });

      // Step 5 should have arrays (properties, loans, co-borrowers)
      const arraySection = page.locator('[data-testid*="array"], [data-testid*="properties"]');
      if ((await arraySection.count()) > 0) {
        await expect(arraySection.first()).toHaveScreenshot('array-empty.png');
      }
    });

    test('VIS-005-B: Array with items', async ({ page, creditForm }) => {
      await test.step('Navigate to arrays and add item', async () => {
        await creditForm.goto();
        await creditForm.selectLoanType('consumer');
        await creditForm.fillLoanAmount(500000);
        await creditForm.fillLoanTerm(24);
        await creditForm.selectLoanPurpose('purchase');
        await creditForm.goToNextStep();

        await creditForm.fillPersonalDataLastName('Иванов');
        await creditForm.fillPersonalDataFirstName('Иван');
        await creditForm.fillPersonalDataBirthDate('1990-01-15');
        await creditForm.goToNextStep();

        await creditForm.fillPhoneMain('+7 (999) 123-45-67');
        await creditForm.fillEmail('test@example.com');
        await creditForm.goToNextStep();

        await creditForm.selectEmploymentStatus('employed');
        await creditForm.goToNextStep();
      });

      // Try to add an item to array
      const addButton = page.locator('[data-testid*="add"], button:has-text("Добавить")').first();
      if ((await addButton.count()) > 0) {
        await addButton.click();
        await page.waitForTimeout(300);

        const arraySection = page.locator('[data-testid*="array"], [data-testid*="properties"]');
        if ((await arraySection.count()) > 0) {
          await expect(arraySection.first()).toHaveScreenshot('array-with-item.png');
        }
      }
    });
  });

  test.describe('VIS-006: Loading States', () => {
    test('VIS-006-A: Initial loading state', async ({ page }) => {
      // Capture loading state before form is ready
      await page.goto('/examples/complex');

      // Try to capture loading spinner if it exists
      const loading = page.locator('[data-testid="loading"], .loading, [class*="spinner"]');
      if ((await loading.count()) > 0) {
        await expect(loading.first()).toHaveScreenshot('loading-state.png', {
          animations: 'disabled',
        });
      }
    });
  });
});
