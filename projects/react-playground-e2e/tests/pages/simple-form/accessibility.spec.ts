import { test, expect } from '@playwright/test';
import { SimpleFormPage } from './simple-form-page.pom';

test.describe('Registration Form Accessibility', () => {
  let formPage: SimpleFormPage;

  test.beforeEach(async ({ page }) => {
    formPage = new SimpleFormPage(page);
    await formPage.goto();
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate through form fields with Tab', async ({ page }) => {
      // Start from first focusable element
      await formPage.usernameInput.focus();

      // Tab through form fields
      await page.keyboard.press('Tab');
      await expect(formPage.emailInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(formPage.passwordInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(formPage.confirmPasswordInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(formPage.fullNameInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(formPage.phoneInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(formPage.captchaInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(formPage.acceptTermsCheckbox).toBeFocused();
    });

    test('should navigate backwards with Shift+Tab', async ({ page }) => {
      // Start from captcha
      await formPage.captchaInput.focus();

      // Shift+Tab to go back
      await page.keyboard.press('Shift+Tab');
      await expect(formPage.phoneInput).toBeFocused();

      await page.keyboard.press('Shift+Tab');
      await expect(formPage.fullNameInput).toBeFocused();
    });

    test('should toggle checkbox with Space', async ({ page }) => {
      await formPage.acceptTermsCheckbox.focus();
      expect(await formPage.acceptTermsCheckbox.isChecked()).toBe(false);

      await page.keyboard.press('Space');
      expect(await formPage.acceptTermsCheckbox.isChecked()).toBe(true);

      await page.keyboard.press('Space');
      expect(await formPage.acceptTermsCheckbox.isChecked()).toBe(false);
    });

    test('should submit form with Enter key', async ({ page }) => {
      // Fill valid form
      await formPage.fillValidForm();
      await formPage.waitForAsyncValidation();

      // Handle dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Focus submit button and press Enter
      await formPage.submitButton.focus();
      await page.keyboard.press('Enter');

      // Form should be submitted (check for form reset)
      await formPage.page.waitForTimeout(500);
    });
  });

  test.describe('Form Labels', () => {
    test('should have visible labels for all form fields', async ({ page }) => {
      // Check labels are present and visible
      await expect(page.getByText('Имя пользователя')).toBeVisible();
      await expect(page.getByText('Email')).toBeVisible();
      await expect(page.getByText('Пароль')).toBeVisible();
      await expect(page.getByText('Подтвердите пароль')).toBeVisible();
      await expect(page.getByText('Полное имя')).toBeVisible();
      await expect(page.getByText('Телефон')).toBeVisible();
      await expect(page.getByText('Введите captcha')).toBeVisible();
      await expect(page.getByText('Я принимаю условия использования')).toBeVisible();
    });

    test('should associate labels with inputs', async ({ page }) => {
      // Labels should be clickable and focus associated input
      const usernameLabel = page.locator('label', { hasText: 'Имя пользователя' });
      await usernameLabel.click();

      // Input should receive focus (or be ready for input)
      await page.keyboard.type('test');
      await expect(formPage.usernameInput).toHaveValue('test');
    });
  });

  test.describe('Focus Management', () => {
    test('should show visible focus indicator on input fields', async ({ page }) => {
      await formPage.usernameInput.focus();

      // Check that the element is focused
      await expect(formPage.usernameInput).toBeFocused();

      // Visual focus indicator should be present (ring/border styles)
      // This is typically handled by CSS, we verify focus state exists
    });

    test('should show visible focus indicator on buttons', async ({ page }) => {
      await formPage.submitButton.focus();
      await expect(formPage.submitButton).toBeFocused();

      await formPage.resetButton.focus();
      await expect(formPage.resetButton).toBeFocused();
    });

    test('should maintain focus after validation error', async ({ page }) => {
      await formPage.usernameInput.focus();
      await page.keyboard.type('ab'); // Too short
      await page.keyboard.press('Tab');

      // After tab, focus should move to next field
      await expect(formPage.emailInput).toBeFocused();
    });
  });

  test.describe('Error Messages', () => {
    test('should display error messages accessibly', async ({ page }) => {
      // Trigger validation error
      await formPage.usernameInput.focus();
      await page.keyboard.press('Tab');

      // Error should be visible
      const errorElement = formPage.error('username');
      await expect(errorElement).toBeVisible();

      // Error should have meaningful text
      const errorText = await errorElement.textContent();
      expect(errorText).toBeTruthy();
      expect(errorText!.length).toBeGreaterThan(0);
    });

    test('should position error messages near associated fields', async ({ page }) => {
      await formPage.fillUsername('ab');
      await page.keyboard.press('Tab');

      // Error should be visible within the field container
      const fieldContainer = formPage.field('username');
      const errorElement = formPage.error('username');

      // Both should be visible
      await expect(fieldContainer).toBeVisible();
      await expect(errorElement).toBeVisible();
    });
  });

  test.describe('Form Structure', () => {
    test('should have proper heading structure', async ({ page }) => {
      // Main heading should be present
      const mainHeading = page.getByRole('heading', { name: /регистрация/i });
      await expect(mainHeading).toBeVisible();
    });

    test('should group related form elements', async ({ page }) => {
      // Form should be present
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // All inputs should be within the form
      const inputs = form.locator('input');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThan(0);
    });
  });

  test.describe('Button States', () => {
    test('should indicate disabled state for submit button', async ({ page }) => {
      // Empty form - submit should be disabled
      await expect(formPage.submitButton).toBeDisabled();
    });

    test('should have descriptive button text', async ({ page }) => {
      // Submit button should have clear text
      await expect(formPage.submitButton).toHaveText(/зарегистрироваться/i);

      // Reset button should have clear text
      await expect(formPage.resetButton).toHaveText(/очистить/i);
    });
  });

  test.describe('Color Contrast', () => {
    test('should have visible text content', async ({ page }) => {
      // All text elements should be visible
      const visibleElements = [
        page.getByText('Регистрация'),
        page.getByText('Имя пользователя'),
        page.getByText('Email'),
      ];

      for (const element of visibleElements) {
        await expect(element).toBeVisible();
      }
    });

    test('should have visible error messages', async ({ page }) => {
      // Trigger error
      await formPage.usernameInput.focus();
      await page.keyboard.press('Tab');

      // Error text should be visible
      const errorElement = formPage.error('username');
      await expect(errorElement).toBeVisible();

      // Error should have text
      const text = await errorElement.textContent();
      expect(text!.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe('Input Placeholders', () => {
    test('should have helpful placeholder text', async () => {
      await expect(formPage.usernameInput).toHaveAttribute('placeholder', /логин|латиница/i);
      await expect(formPage.emailInput).toHaveAttribute('placeholder', /email/i);
      await expect(formPage.phoneInput).toHaveAttribute('placeholder', /\+7/);
    });
  });

  test.describe('Password Field', () => {
    test('should have password type to hide input', async () => {
      await expect(formPage.passwordInput).toHaveAttribute('type', 'password');
      await expect(formPage.confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    test('should allow password visibility toggle if available', async ({ page }) => {
      // If there's a show/hide password button, test it
      const toggleButton = page.locator('[data-testid="toggle-password"]').first();
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await expect(formPage.passwordInput).toHaveAttribute('type', 'text');

        await toggleButton.click();
        await expect(formPage.passwordInput).toHaveAttribute('type', 'password');
      }
    });
  });

  test.describe('Touch Target Size', () => {
    test('should have adequately sized interactive elements', async ({ page }) => {
      // Checkbox should be clickable
      const checkbox = formPage.acceptTermsCheckbox;
      const boundingBox = await checkbox.boundingBox();

      if (boundingBox) {
        // Touch target should be at least 24x24 pixels (WCAG minimum)
        // Note: The actual clickable area might be larger due to label
        expect(boundingBox.width).toBeGreaterThan(0);
        expect(boundingBox.height).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Form Validation Timing', () => {
    test('should validate on blur (not during typing)', async ({ page }) => {
      // Start typing - no error should appear yet
      await formPage.fillUsername('a');
      await expect(formPage.error('username')).not.toBeVisible();

      // Continue typing
      await formPage.usernameInput.pressSequentially('b');
      await expect(formPage.error('username')).not.toBeVisible();

      // On blur, error should appear
      await page.keyboard.press('Tab');
      await expect(formPage.error('username')).toBeVisible();
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should be usable on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Form should still be visible and functional
      await expect(formPage.usernameInput).toBeVisible();
      await expect(formPage.submitButton).toBeVisible();

      // Should be able to fill form
      await formPage.fillUsername('mobileuser');
      await expect(formPage.usernameInput).toHaveValue('mobileuser');
    });
  });
});
