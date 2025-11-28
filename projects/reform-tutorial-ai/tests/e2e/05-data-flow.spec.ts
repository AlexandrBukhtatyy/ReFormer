import { test, expect, type Page } from '@playwright/test';

// Helper to clear localStorage
async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

// Helper to set draft in localStorage
async function setDraft(page: Page, data: Record<string, unknown>, timestamp?: string) {
  await page.evaluate(({ data, timestamp }) => {
    localStorage.setItem('credit-application-draft', JSON.stringify(data));
    localStorage.setItem('credit-application-draft-timestamp', timestamp || new Date().toISOString());
  }, { data, timestamp });
}

// Helper to get draft from localStorage
async function getDraft(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const draft = localStorage.getItem('credit-application-draft');
    return draft ? JSON.parse(draft) : null;
  });
}

// Helper to check if draft exists
async function hasDraft(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return localStorage.getItem('credit-application-draft') !== null;
  });
}

test.describe('05 - Data Flow: Form Data Management', () => {
  test.describe('Autosave', () => {
    test('should autosave form data after changes', async ({ page }) => {
      await page.goto('/');
      await clearStorage(page);
      await page.reload();

      // Fill in some data using the Select trigger (first one on the page)
      await page.click('[data-slot="select-trigger"]');
      await page.getByRole('option', { name: 'Consumer' }).click();

      // Fill loan amount (first input field)
      const loanAmountInput = page.locator('input').nth(0);
      await loanAmountInput.fill('300000');

      // Wait for autosave (debounced at 2000ms + margin)
      await page.waitForTimeout(3500);

      // Check that draft was saved
      const draft = await getDraft(page);
      expect(draft).not.toBeNull();
      expect(draft?.loanType).toBe('consumer');
      expect(draft?.loanAmount).toBe(300000);
    });

    test('should show last saved timestamp after autosave', async ({ page }) => {
      await page.goto('/');
      await clearStorage(page);
      await page.reload();

      // Fill in some data
      const loanAmountInput = page.locator('input').nth(0);
      await loanAmountInput.fill('100000');

      // Wait for autosave
      await page.waitForTimeout(3500);

      // Check status shows last saved time
      const autosaveStatus = page.getByTestId('autosave-status');
      await expect(autosaveStatus).toContainText('Last saved:');
    });
  });

  test.describe('Draft Restoration', () => {
    test('should show draft banner when draft exists', async ({ page }) => {
      await page.goto('/');

      // Set up draft
      await setDraft(page, {
        loanType: 'mortgage',
        loanAmount: 1000000,
        personalData: {
          lastName: 'Test',
          firstName: 'User'
        }
      });

      // Reload page to trigger draft detection
      await page.reload();

      // Draft banner should be visible
      const draftBanner = page.getByTestId('draft-banner');
      await expect(draftBanner).toBeVisible();
      await expect(draftBanner).toContainText('Draft found');
    });

    test('should restore draft when "Restore Draft" clicked', async ({ page }) => {
      await page.goto('/');

      // Set up draft with specific values
      await setDraft(page, {
        loanType: 'car',
        loanAmount: 750000,
        loanTerm: 36,
        loanPurpose: 'New car purchase'
      });

      await page.reload();

      // Click restore button
      await page.getByTestId('load-draft').click();

      // Banner should disappear
      await expect(page.getByTestId('draft-banner')).not.toBeVisible();

      // Form should be populated with draft values - check loan amount
      const loanAmountInput = page.locator('input').nth(0);
      await expect(loanAmountInput).toHaveValue('750000');

      // Check loan term
      const loanTermInput = page.locator('input').nth(1);
      await expect(loanTermInput).toHaveValue('36');
    });

    test('should discard draft when "Discard" clicked', async ({ page }) => {
      await page.goto('/');

      await setDraft(page, {
        loanType: 'consumer',
        loanAmount: 200000
      });

      await page.reload();

      // Click discard button
      await page.getByTestId('discard-draft').click();

      // Banner should disappear
      await expect(page.getByTestId('draft-banner')).not.toBeVisible();

      // Draft should be cleared from localStorage
      const draftExists = await hasDraft(page);
      expect(draftExists).toBe(false);
    });

    test('should show draft timestamp in banner', async ({ page }) => {
      await page.goto('/');

      const timestamp = new Date('2024-01-15T10:30:00').toISOString();
      await setDraft(page, { loanType: 'consumer' }, timestamp);

      await page.reload();

      const draftBanner = page.getByTestId('draft-banner');
      await expect(draftBanner).toContainText('unsaved draft from');
    });
  });

  test.describe('Form Value Operations', () => {
    test('should persist values across step navigation', async ({ page }) => {
      await page.goto('/');
      await clearStorage(page);
      await page.reload();

      // Step 1: Fill loan info
      await page.click('[data-slot="select-trigger"]');
      await page.getByRole('option', { name: 'Consumer' }).click();

      const loanAmountInput = page.locator('input').nth(0);
      await loanAmountInput.fill('500000');

      const loanTermInput = page.locator('input').nth(1);
      await loanTermInput.fill('24');

      // Navigate to step 2
      await page.click('button:has-text("Next")');

      // Navigate to step 3
      await page.click('button:has-text("Next")');

      // Go back to step 1
      await page.click('button:has-text("1. Loan")');

      // Values should be preserved
      await expect(loanAmountInput).toHaveValue('500000');
      await expect(loanTermInput).toHaveValue('24');
    });

    test('should restore nested form data from draft', async ({ page }) => {
      await page.goto('/');

      // Set draft with nested personal data
      await setDraft(page, {
        loanType: 'consumer',
        personalData: {
          lastName: 'Иванов',
          firstName: 'Иван',
          middleName: 'Иванович',
          birthDate: '1990-05-15',
          gender: 'male'
        }
      });

      await page.reload();

      // Restore draft
      await page.getByTestId('load-draft').click();

      // Navigate to step 2 (Personal Info)
      await page.click('button:has-text("2. Personal")');

      // Check nested fields are populated using the correct testId format (personal-{fieldName})
      await expect(page.getByTestId('input-personal-lastName')).toHaveValue('Иванов');
      await expect(page.getByTestId('input-personal-firstName')).toHaveValue('Иван');
      await expect(page.getByTestId('input-personal-middleName')).toHaveValue('Иванович');
    });
  });

  test.describe('Draft Clearing', () => {
    test('should clear draft after successful submission', async ({ page }) => {
      await page.goto('/');

      // Set up draft
      await setDraft(page, {
        loanType: 'consumer',
        loanAmount: 100000
      });

      await page.reload();

      // Restore draft
      await page.getByTestId('load-draft').click();

      // Navigate to last step
      await page.click('button:has-text("6. Confirm")');

      // Submit the form
      await page.click('button:has-text("Submit Application")');

      // Wait for submission to complete (may succeed or fail due to random failure)
      await expect(page.getByTestId('submit-result')).toBeVisible({ timeout: 5000 });

      // Check result
      const submitResult = page.getByTestId('submit-result');
      const resultText = await submitResult.textContent();

      if (resultText?.includes('successfully')) {
        // Draft should be cleared on success
        const draftExists = await hasDraft(page);
        expect(draftExists).toBe(false);
      }
      // If failed, draft may still exist - that's expected behavior
    });
  });
});

test.describe('05 - Data Flow: Error Handling', () => {
  test('should handle corrupted draft gracefully', async ({ page }) => {
    await page.goto('/');

    // Set corrupted draft data
    await page.evaluate(() => {
      localStorage.setItem('credit-application-draft', 'not-valid-json');
      localStorage.setItem('credit-application-draft-timestamp', new Date().toISOString());
    });

    // Page should load without errors
    await page.reload();

    // The form should still be functional
    await page.click('[data-slot="select-trigger"]');
    await expect(page.getByRole('option', { name: 'Consumer' })).toBeVisible();
  });
});
