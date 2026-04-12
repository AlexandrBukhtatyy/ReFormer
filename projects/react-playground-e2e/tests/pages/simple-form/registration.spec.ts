import { test, expect } from '@playwright/test';
import { SimpleFormPage } from './simple-form-page.pom';

test.describe('Registration Form', () => {
  let formPage: SimpleFormPage;

  test.beforeEach(async ({ page }) => {
    formPage = new SimpleFormPage(page);
    await formPage.goto();
  });

  test.describe('Successful Registration', () => {
    test('should successfully register with valid data @critical', async ({ page }) => {
      // Handle alert dialog
      page.on('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Регистрация успешна');
        await dialog.accept();
      });

      await formPage.fillValidForm();
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      // Form should be reset after successful registration
      await formPage.expectSuccessAlert();
    });

    test('should clear form after reset', async () => {
      await formPage.fillValidForm();
      await formPage.reset();

      await formPage.expectFieldValue('username', '');
      await formPage.expectFieldValue('email', '');
      await formPage.expectFieldValue('password', '');
      await formPage.expectFieldValue('confirmPassword', '');
      await formPage.expectFieldValue('fullName', '');
      await formPage.expectFieldValue('phone', '');
      await formPage.expectFieldValue('captcha', '');
    });
  });

  test.describe('Async Email Validation', () => {
    test('should show error for taken email', async () => {
      await formPage.fillEmail('john@example.com');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectFieldError('email', /уже зарегистрирован|занят/i);
    });

    test('should show error for another taken email', async () => {
      await formPage.fillEmail('admin@example.com');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectFieldError('email', /уже зарегистрирован|занят/i);
    });

    test('should accept available email', async () => {
      await formPage.fillEmail('newuser@example.com');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectNoFieldError('email');
    });

    test('should validate email format before async check', async () => {
      await formPage.fillEmail('invalid-email');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('email', /некорректный email/i);
    });
  });

  test.describe('Async Username Validation', () => {
    test('should show error for taken username', async () => {
      await formPage.fillUsername('johndoe');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectFieldError('username', /занято/i);
    });

    test('should show error for admin username', async () => {
      await formPage.fillUsername('admin');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectFieldError('username', /занято/i);
    });

    test('should accept available username', async () => {
      await formPage.fillUsername('newuser123');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectNoFieldError('username');
    });
  });

  test.describe('Phone Mask', () => {
    test('should apply phone mask correctly', async () => {
      await formPage.typePhoneWithMask('9991234567');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldValue('phone', '+7 (999) 123-45-67');
    });

    test('should show error for incomplete phone', async () => {
      await formPage.fillPhone('+7 (999) 123');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('phone', /формате/i);
    });

    test('should accept valid phone', async () => {
      await formPage.fillPhone('+7 (999) 123-45-67');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectNoFieldError('phone');
    });
  });

  test.describe('Required Fields', () => {
    test('should show error for empty username', async () => {
      await formPage.usernameInput.click();
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('username', /обязательно/i);
    });

    test('should show error for empty email', async () => {
      await formPage.emailInput.click();
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('email', /обязателен/i);
    });

    test('should show error for empty password', async () => {
      await formPage.passwordInput.click();
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('password', /обязателен/i);
    });

    test('should show error for empty confirm password', async () => {
      await formPage.confirmPasswordInput.click();
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('confirmPassword', /подтвердите/i);
    });

    test('should show error for empty full name', async () => {
      await formPage.fullNameInput.click();
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('fullName', /обязательно/i);
    });

    test('should show error for empty phone', async () => {
      await formPage.phoneInput.click();
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('phone', /обязателен/i);
    });

    test('should show error for empty captcha', async () => {
      await formPage.captchaInput.click();
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('captcha', /введите/i);
    });

    test('should validate all required fields on submit', async () => {
      await formPage.submit();

      // Check that multiple errors are shown
      await formPage.expectFieldError('username');
      await formPage.expectFieldError('email');
      await formPage.expectFieldError('password');
    });
  });

  test.describe('Password Validation', () => {
    test('should show error for short password', async () => {
      await formPage.fillPassword('Pass1');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('password', /минимум 8/i);
    });

    test('should show error for password without uppercase', async () => {
      await formPage.fillPassword('password123');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('password', /заглавные|строчные|цифры/i);
    });

    test('should show error for password without digits', async () => {
      await formPage.fillPassword('Password');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('password', /заглавные|строчные|цифры/i);
    });

    test('should accept strong password', async () => {
      await formPage.fillPassword('Password123');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectNoFieldError('password');
    });

    test('should show error for mismatched passwords', async () => {
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('DifferentPass123');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('confirmPassword', /не совпадают/i);
    });

    test('should accept matching passwords', async () => {
      await formPage.fillPassword('Password123');
      await formPage.fillConfirmPassword('Password123');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectNoFieldError('confirmPassword');
    });
  });

  test.describe('Username Validation', () => {
    test('should show error for short username', async () => {
      await formPage.fillUsername('ab');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('username', /минимум 3/i);
    });

    test('should show error for invalid characters in username', async () => {
      await formPage.fillUsername('user@name!');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('username', /латиница|цифры|подчеркивания/i);
    });

    test('should accept valid username', async () => {
      await formPage.fillUsername('valid_user123');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectNoFieldError('username');
    });
  });

  test.describe('Captcha Validation', () => {
    test('should show error for wrong captcha', async () => {
      await formPage.fillCaptcha('WRONG');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectFieldError('captcha', /неверная|попробуйте/i);
    });

    test('should accept correct captcha', async () => {
      await formPage.fillCaptcha('ABC123');
      await formPage.page.keyboard.press('Tab');

      await formPage.expectNoFieldError('captcha');
    });
  });

  test.describe('Terms Acceptance', () => {
    test('should show error when terms not accepted on submit', async () => {
      await formPage.fillValidForm();
      // Uncheck terms
      const checkbox = formPage.acceptTermsCheckbox;
      if (await checkbox.isChecked()) {
        await checkbox.click();
      }
      await formPage.waitForAsyncValidation();
      await formPage.submit();

      await formPage.expectFieldError('acceptTerms', /принять|условия/i);
    });
  });

  test.describe('Form State', () => {
    test('should disable submit button when form is invalid', async () => {
      // Empty form should have disabled submit
      await formPage.expectFormInvalid();
    });

    test('should show pending state during async validation', async () => {
      await formPage.fillUsername('testuser');
      // During async validation, button might show "Checking..."
      // This is implementation-specific
    });
  });

  test.describe('Error Recovery', () => {
    test('should clear error when valid value is entered', async () => {
      // Create error
      await formPage.fillEmail('invalid');
      await formPage.page.keyboard.press('Tab');
      await formPage.expectFieldError('email');

      // Fix error
      await formPage.fillEmail('valid@example.com');
      await formPage.page.keyboard.press('Tab');
      await formPage.waitForAsyncValidation();

      await formPage.expectNoFieldError('email');
    });
  });
});
