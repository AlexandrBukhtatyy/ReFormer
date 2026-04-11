import { test, expect } from '@playwright/test';
import { ValidationPage } from '../pages/ValidationPage';

test.describe('Validation Examples', () => {
  let validationPage: ValidationPage;

  test.beforeEach(async ({ page }) => {
    validationPage = new ValidationPage(page);
    await validationPage.goto();
    await validationPage.expandAllSections();
  });

  test.describe('String Validators', () => {
    test.describe('required validator', () => {
      test('should show error for empty field @critical', async ({ page }) => {
        await validationPage.input('requiredField').focus();
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('requiredField', /обязательно/i);
      });

      test('should accept non-empty value', async ({ page }) => {
        await validationPage.fillRequiredField('test value');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('requiredField');
      });

      test('should show error after clearing value', async ({ page }) => {
        await validationPage.fillRequiredField('test');
        await page.keyboard.press('Tab');
        await validationPage.expectNoFieldError('requiredField');

        await validationPage.fillRequiredField('');
        await page.keyboard.press('Tab');
        await validationPage.expectFieldError('requiredField');
      });
    });

    test.describe('email validator', () => {
      test('should show error for invalid email @critical', async ({ page }) => {
        await validationPage.fillEmailField('invalid-email');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('emailField', /корректный email/i);
      });

      test('should show error for email without domain', async ({ page }) => {
        await validationPage.fillEmailField('test@');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('emailField');
      });

      test('should show error for email without @', async ({ page }) => {
        await validationPage.fillEmailField('test.example.com');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('emailField');
      });

      test('should accept valid email', async ({ page }) => {
        await validationPage.fillEmailField('test@example.com');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('emailField');
      });

      test('should accept email with subdomain', async ({ page }) => {
        await validationPage.fillEmailField('test@mail.example.com');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('emailField');
      });
    });

    test.describe('minLength validator', () => {
      test('should show error for short string @critical', async ({ page }) => {
        await validationPage.fillMinLengthField('abc'); // 3 chars, min is 5
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('minLengthField', /минимум 5/i);
      });

      test('should accept string at minimum length', async ({ page }) => {
        await validationPage.fillMinLengthField('abcde'); // exactly 5 chars
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minLengthField');
      });

      test('should accept string above minimum length', async ({ page }) => {
        await validationPage.fillMinLengthField('abcdefghij'); // 10 chars
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minLengthField');
      });
    });

    test.describe('maxLength validator', () => {
      test('should show error for long string @critical', async ({ page }) => {
        await validationPage.fillMaxLengthField('this is way too long'); // >10 chars
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('maxLengthField', /максимум 10/i);
      });

      test('should accept string at maximum length', async ({ page }) => {
        await validationPage.fillMaxLengthField('1234567890'); // exactly 10 chars
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxLengthField');
      });

      test('should accept short string', async ({ page }) => {
        await validationPage.fillMaxLengthField('short');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxLengthField');
      });
    });

    test.describe('pattern validator', () => {
      test('should show error for invalid pattern @critical', async ({ page }) => {
        await validationPage.fillPatternField('abc123'); // contains numbers
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('patternField', /только буквы/i);
      });

      test('should show error for special characters', async ({ page }) => {
        await validationPage.fillPatternField('abc@def');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('patternField');
      });

      test('should accept letters only', async ({ page }) => {
        await validationPage.fillPatternField('letters');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('patternField');
      });

      test('should accept cyrillic letters', async ({ page }) => {
        await validationPage.fillPatternField('буквы');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('patternField');
      });
    });

    test.describe('url validator', () => {
      test('should show error for invalid URL @critical', async ({ page }) => {
        await validationPage.fillUrlField('not-a-url');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('urlField', /корректный URL/i);
      });

      test('should show error for incomplete URL', async ({ page }) => {
        await validationPage.fillUrlField('http://');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('urlField');
      });

      test('should accept valid http URL', async ({ page }) => {
        await validationPage.fillUrlField('http://example.com');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('urlField');
      });

      test('should accept valid https URL', async ({ page }) => {
        await validationPage.fillUrlField('https://example.com');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('urlField');
      });

      test('should accept URL with path', async ({ page }) => {
        await validationPage.fillUrlField('https://example.com/path/to/page');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('urlField');
      });
    });

    test.describe('phone validator', () => {
      test('should show error for invalid phone @critical', async ({ page }) => {
        await validationPage.fillPhoneField('123');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('phoneField', /российский номер/i);
      });

      test('should show error for non-numeric characters', async ({ page }) => {
        await validationPage.fillPhoneField('phone number');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('phoneField');
      });

      test('should accept valid Russian phone', async ({ page }) => {
        await validationPage.fillPhoneField('+7 900 123-45-67');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('phoneField');
      });

      test('should accept phone in different format', async ({ page }) => {
        await validationPage.fillPhoneField('+79001234567');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('phoneField');
      });
    });
  });

  test.describe('Number Validators', () => {
    test.describe('min validator', () => {
      test('should show error for value below minimum @critical', async ({ page }) => {
        await validationPage.fillMinField(5); // min is 10
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('minField', /минимум 10/i);
      });

      test('should accept value at minimum', async ({ page }) => {
        await validationPage.fillMinField(10);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minField');
      });

      test('should accept value above minimum', async ({ page }) => {
        await validationPage.fillMinField(50);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minField');
      });
    });

    test.describe('max validator', () => {
      test('should show error for value above maximum @critical', async ({ page }) => {
        await validationPage.fillMaxField(150); // max is 100
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('maxField', /максимум 100/i);
      });

      test('should accept value at maximum', async ({ page }) => {
        await validationPage.fillMaxField(100);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxField');
      });

      test('should accept value below maximum', async ({ page }) => {
        await validationPage.fillMaxField(50);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxField');
      });
    });

    test.describe('number validator', () => {
      test('should show error for value outside range @critical', async ({ page }) => {
        await validationPage.fillNumberField(150); // max is 100
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('numberField', /1 до 100/i);
      });

      test('should show error for zero', async ({ page }) => {
        await validationPage.fillNumberField(0); // min is 1
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('numberField');
      });

      test('should accept value in range', async ({ page }) => {
        await validationPage.fillNumberField(50);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('numberField');
      });

      test('should accept boundary values', async ({ page }) => {
        await validationPage.fillNumberField(1);
        await page.keyboard.press('Tab');
        await validationPage.expectNoFieldError('numberField');

        await validationPage.fillNumberField(100);
        await page.keyboard.press('Tab');
        await validationPage.expectNoFieldError('numberField');
      });
    });
  });

  test.describe('Date Validators', () => {
    test.describe('pastDate validator', () => {
      test('should show error for future date @critical', async ({ page }) => {
        await validationPage.fillDateField('2030-01-01');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('dateField', /не может быть в будущем/i);
      });

      test('should accept past date', async ({ page }) => {
        await validationPage.fillDateField('2020-01-01');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('dateField');
      });

      test('should accept today date', async ({ page }) => {
        const today = new Date().toISOString().split('T')[0];
        await validationPage.fillDateField(today);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('dateField');
      });
    });

    test.describe('isDate validator', () => {
      test('should show error for empty date @critical', async ({ page }) => {
        await validationPage.input('isDateField').focus();
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('isDateField', /обязательна|корректную дату/i);
      });

      test('should accept valid date', async ({ page }) => {
        await validationPage.fillIsDateField('2024-06-15');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('isDateField');
      });
    });

    test.describe('minDate validator', () => {
      test('should show error for date before minimum @critical', async ({ page }) => {
        await validationPage.fillMinDateField('2019-01-01'); // min is 2020-01-01
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('minDateField', /раньше 01.01.2020/i);
      });

      test('should accept date at minimum', async ({ page }) => {
        await validationPage.fillMinDateField('2020-01-01');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minDateField');
      });

      test('should accept date after minimum', async ({ page }) => {
        await validationPage.fillMinDateField('2022-06-15');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minDateField');
      });
    });

    test.describe('maxDate validator', () => {
      test('should show error for date after maximum @critical', async ({ page }) => {
        await validationPage.fillMaxDateField('2030-01-01'); // max is today
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('maxDateField', /позже сегодня/i);
      });

      test('should accept date before today', async ({ page }) => {
        await validationPage.fillMaxDateField('2020-01-01');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxDateField');
      });

      test('should accept today date', async ({ page }) => {
        const today = new Date().toISOString().split('T')[0];
        await validationPage.fillMaxDateField(today);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxDateField');
      });
    });

    test.describe('futureDate validator', () => {
      test('should show error for past date @critical', async ({ page }) => {
        await validationPage.fillFutureDateField('2020-01-01');
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('futureDateField', /в будущем/i);
      });

      test('should accept future date', async ({ page }) => {
        await validationPage.fillFutureDateField('2030-01-01');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('futureDateField');
      });
    });

    test.describe('minAge validator', () => {
      test('should show error for age below minimum @critical', async ({ page }) => {
        // Date that makes person younger than 18
        const youngDate = new Date();
        youngDate.setFullYear(youngDate.getFullYear() - 15);
        const dateStr = youngDate.toISOString().split('T')[0];

        await validationPage.fillMinAgeField(dateStr);
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('minAgeField', /минимальный возраст.*18/i);
      });

      test('should accept age at minimum', async ({ page }) => {
        // Date that makes person exactly 18
        const minAgeDate = new Date();
        minAgeDate.setFullYear(minAgeDate.getFullYear() - 18);
        const dateStr = minAgeDate.toISOString().split('T')[0];

        await validationPage.fillMinAgeField(dateStr);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minAgeField');
      });

      test('should accept age above minimum', async ({ page }) => {
        // Date that makes person 30 years old
        const adultDate = new Date();
        adultDate.setFullYear(adultDate.getFullYear() - 30);
        const dateStr = adultDate.toISOString().split('T')[0];

        await validationPage.fillMinAgeField(dateStr);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('minAgeField');
      });
    });

    test.describe('maxAge validator', () => {
      test('should show error for age above maximum @critical', async ({ page }) => {
        // Date that makes person older than 65
        const oldDate = new Date();
        oldDate.setFullYear(oldDate.getFullYear() - 70);
        const dateStr = oldDate.toISOString().split('T')[0];

        await validationPage.fillMaxAgeField(dateStr);
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('maxAgeField', /максимальный возраст.*65/i);
      });

      test('should accept age at maximum', async ({ page }) => {
        // Date that makes person exactly 65
        const maxAgeDate = new Date();
        maxAgeDate.setFullYear(maxAgeDate.getFullYear() - 65);
        const dateStr = maxAgeDate.toISOString().split('T')[0];

        await validationPage.fillMaxAgeField(dateStr);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxAgeField');
      });

      test('should accept age below maximum', async ({ page }) => {
        // Date that makes person 40 years old
        const middleAgeDate = new Date();
        middleAgeDate.setFullYear(middleAgeDate.getFullYear() - 40);
        const dateStr = middleAgeDate.toISOString().split('T')[0];

        await validationPage.fillMaxAgeField(dateStr);
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('maxAgeField');
      });
    });
  });

  test.describe('Custom Validators', () => {
    test.describe('validate (custom password validator)', () => {
      test('should show error for short password @critical', async ({ page }) => {
        await validationPage.fillCustomField('Pass1'); // < 8 chars
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('customField', /минимум 8/i);
      });

      test('should show error for password without digit', async ({ page }) => {
        await validationPage.fillCustomField('Password'); // no digit
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('customField', /цифра/i);
      });

      test('should show error for password without letter', async ({ page }) => {
        await validationPage.fillCustomField('12345678'); // no letter
        await page.keyboard.press('Tab');

        await validationPage.expectFieldError('customField', /буква/i);
      });

      test('should accept valid password', async ({ page }) => {
        await validationPage.fillCustomField('Password1');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('customField');
      });

      test('should accept complex password', async ({ page }) => {
        await validationPage.fillCustomField('SecureP@ss123');
        await page.keyboard.press('Tab');

        await validationPage.expectNoFieldError('customField');
      });
    });
  });

  test.describe('Validate All Button', () => {
    test('should validate all fields at once @critical', async () => {
      // Leave all fields empty
      await validationPage.validateAll();

      // All required fields should show errors
      await validationPage.expectFieldError('requiredField');
      await validationPage.expectFieldError('emailField');
      await validationPage.expectFieldError('minLengthField');
      await validationPage.expectFieldError('patternField');
      await validationPage.expectFieldError('urlField');
      await validationPage.expectFieldError('phoneField');
      await validationPage.expectFieldError('minField');
      await validationPage.expectFieldError('maxField');
      await validationPage.expectFieldError('numberField');
    });

    test('should clear all errors on reset', async () => {
      // Trigger errors
      await validationPage.validateAll();

      // Reset
      await validationPage.reset();

      // Errors should be cleared
      await validationPage.expectNoFieldError('requiredField');
      await validationPage.expectNoFieldError('emailField');
    });
  });

  test.describe('Error Recovery', () => {
    test('should clear error when valid value is entered', async ({ page }) => {
      // Create error
      await validationPage.fillEmailField('invalid');
      await page.keyboard.press('Tab');
      await validationPage.expectFieldError('emailField');

      // Fix with valid value
      await validationPage.fillEmailField('valid@example.com');
      await page.keyboard.press('Tab');
      await validationPage.expectNoFieldError('emailField');
    });

    test('should show different error on different validation failure', async ({ page }) => {
      // First error - required
      await validationPage.input('emailField').focus();
      await page.keyboard.press('Tab');
      await validationPage.expectFieldError('emailField', /обязателен/i);

      // Different error - format
      await validationPage.fillEmailField('invalid');
      await page.keyboard.press('Tab');
      await validationPage.expectFieldError('emailField', /корректный email/i);
    });
  });

  test.describe('Section Toggle', () => {
    test('should collapse and expand sections', async () => {
      await validationPage.collapseAllSections();

      // Fields in collapsed sections should not be visible
      await expect(validationPage.input('requiredField')).not.toBeVisible();

      await validationPage.expandAllSections();

      // Fields should be visible again
      await expect(validationPage.input('requiredField')).toBeVisible();
    });
  });
});
