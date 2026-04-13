/**
 * Validation Examples E2E Tests
 *
 * Тесты примеров валидации:
 * - Строковые валидаторы (required, email, minLength, maxLength, pattern, url, phone)
 * - Числовые валидаторы (min, max, number)
 * - Валидаторы дат (pastDate, isDate, minDate, maxDate, futureDate, minAge, maxAge)
 * - Кастомные валидаторы
 *
 * @tag @validation
 */

import { test, expect } from '@playwright/test';
import { ValidationPage } from './validation-page.pom';

test.describe('Примеры валидации', { tag: ['@validation'] }, () => {
  let validationPage: ValidationPage;

  test.beforeEach(async ({ page }) => {
    validationPage = new ValidationPage(page);
    await validationPage.goto();
    await validationPage.expandAllSections();
  });

  test.describe('Строковые валидаторы', () => {
    test.describe('SVAL-001: Обязательное поле (required)', () => {
      test('SVAL-001-A: Ошибка для пустого поля', async () => {
        await validationPage.input('requiredField').focus();
        await validationPage.validateAll();

        await validationPage.expectFieldError('requiredField', /обязательно/i);
      });

      test('SVAL-001-B: Принятие непустого значения', async () => {
        await validationPage.fillRequiredField('test value');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('requiredField');
      });

      test('SVAL-001-C: Ошибка после очистки значения', async () => {
        await validationPage.fillRequiredField('test');
        await validationPage.validateAll();
        await validationPage.expectNoFieldError('requiredField');

        await validationPage.fillRequiredField('');
        await validationPage.validateAll();
        await validationPage.expectFieldError('requiredField');
      });
    });

    test.describe('SVAL-002: Email валидатор', () => {
      test('SVAL-002-A: Ошибка для невалидного email', async () => {
        await validationPage.fillEmailField('invalid-email');
        await validationPage.validateAll();

        await validationPage.expectFieldError('emailField', /корректный email/i);
      });

      test('SVAL-002-B: Ошибка для email без домена', async () => {
        await validationPage.fillEmailField('test@');
        await validationPage.validateAll();

        await validationPage.expectFieldError('emailField');
      });

      test('SVAL-002-C: Ошибка для email без @', async () => {
        await validationPage.fillEmailField('test.example.com');
        await validationPage.validateAll();

        await validationPage.expectFieldError('emailField');
      });

      test('SVAL-002-D: Принятие валидного email', async () => {
        await validationPage.fillEmailField('test@example.com');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('emailField');
      });

      test('SVAL-002-E: Принятие email с поддоменом', async () => {
        await validationPage.fillEmailField('test@mail.example.com');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('emailField');
      });
    });

    test.describe('SVAL-003: Минимальная длина (minLength)', () => {
      test('SVAL-003-A: Ошибка для короткой строки', async () => {
        await validationPage.fillMinLengthField('abc'); // 3 символа, минимум 5
        await validationPage.validateAll();

        await validationPage.expectFieldError('minLengthField', /минимум 5/i);
      });

      test('SVAL-003-B: Принятие строки минимальной длины', async () => {
        await validationPage.fillMinLengthField('abcde'); // ровно 5 символов
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minLengthField');
      });

      test('SVAL-003-C: Принятие строки больше минимума', async () => {
        await validationPage.fillMinLengthField('abcdefghij'); // 10 символов
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minLengthField');
      });
    });

    test.describe('SVAL-004: Максимальная длина (maxLength)', () => {
      test('SVAL-004-A: Ошибка для длинной строки', async () => {
        await validationPage.fillMaxLengthField('this is way too long'); // >10 символов
        await validationPage.validateAll();

        await validationPage.expectFieldError('maxLengthField', /максимум 10/i);
      });

      test('SVAL-004-B: Принятие строки максимальной длины', async () => {
        await validationPage.fillMaxLengthField('1234567890'); // ровно 10 символов
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxLengthField');
      });

      test('SVAL-004-C: Принятие короткой строки', async () => {
        await validationPage.fillMaxLengthField('short');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxLengthField');
      });
    });

    test.describe('SVAL-005: Паттерн (pattern)', () => {
      test('SVAL-005-A: Ошибка для невалидного паттерна', async () => {
        await validationPage.fillPatternField('abc123'); // содержит цифры
        await validationPage.validateAll();

        await validationPage.expectFieldError('patternField', /только буквы/i);
      });

      test('SVAL-005-B: Ошибка для специальных символов', async () => {
        await validationPage.fillPatternField('abc@def');
        await validationPage.validateAll();

        await validationPage.expectFieldError('patternField');
      });

      test('SVAL-005-C: Принятие только букв', async () => {
        await validationPage.fillPatternField('letters');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('patternField');
      });

      test('SVAL-005-D: Принятие кириллических букв', async () => {
        await validationPage.fillPatternField('буквы');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('patternField');
      });
    });

    test.describe('SVAL-006: URL валидатор', () => {
      test('SVAL-006-A: Ошибка для невалидного URL', async () => {
        await validationPage.fillUrlField('not-a-url');
        await validationPage.validateAll();

        await validationPage.expectFieldError('urlField', /корректный URL/i);
      });

      test('SVAL-006-B: Ошибка для неполного URL', async () => {
        await validationPage.fillUrlField('http://');
        await validationPage.validateAll();

        await validationPage.expectFieldError('urlField');
      });

      test('SVAL-006-C: Принятие валидного http URL', async () => {
        await validationPage.fillUrlField('http://example.com');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('urlField');
      });

      test('SVAL-006-D: Принятие валидного https URL', async () => {
        await validationPage.fillUrlField('https://example.com');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('urlField');
      });

      test('SVAL-006-E: Принятие URL с путём', async () => {
        await validationPage.fillUrlField('https://example.com/path/to/page');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('urlField');
      });
    });

    test.describe('SVAL-007: Телефон валидатор', () => {
      test('SVAL-007-A: Ошибка для невалидного телефона', async () => {
        await validationPage.fillPhoneField('123');
        await validationPage.validateAll();

        await validationPage.expectFieldError('phoneField', /российский номер/i);
      });

      test('SVAL-007-B: Ошибка для нецифровых символов', async () => {
        await validationPage.fillPhoneField('phone number');
        await validationPage.validateAll();

        await validationPage.expectFieldError('phoneField');
      });

      test('SVAL-007-C: Принятие валидного российского телефона', async () => {
        await validationPage.fillPhoneField('+7 900 123-45-67');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('phoneField');
      });

      test('SVAL-007-D: Принятие телефона в другом формате', async () => {
        await validationPage.fillPhoneField('+79001234567');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('phoneField');
      });
    });
  });

  test.describe('Числовые валидаторы', () => {
    test.describe('NVAL-001: Минимальное значение (min)', () => {
      test('NVAL-001-A: Ошибка для значения ниже минимума', async () => {
        await validationPage.fillMinField(5); // минимум 10
        await validationPage.validateAll();

        await validationPage.expectFieldError('minField', /минимум 10/i);
      });

      test('NVAL-001-B: Принятие минимального значения', async () => {
        await validationPage.fillMinField(10);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minField');
      });

      test('NVAL-001-C: Принятие значения выше минимума', async () => {
        await validationPage.fillMinField(50);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minField');
      });
    });

    test.describe('NVAL-002: Максимальное значение (max)', () => {
      test('NVAL-002-A: Ошибка для значения выше максимума', async () => {
        await validationPage.fillMaxField(150); // максимум 100
        await validationPage.validateAll();

        await validationPage.expectFieldError('maxField', /максимум 100/i);
      });

      test('NVAL-002-B: Принятие максимального значения', async () => {
        await validationPage.fillMaxField(100);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxField');
      });

      test('NVAL-002-C: Принятие значения ниже максимума', async () => {
        await validationPage.fillMaxField(50);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxField');
      });
    });

    test.describe('NVAL-003: Числовой диапазон (number)', () => {
      test('NVAL-003-A: Ошибка для значения вне диапазона', async () => {
        await validationPage.fillNumberField(150); // максимум 100
        await validationPage.validateAll();

        await validationPage.expectFieldError('numberField', /1 до 100/i);
      });

      test('NVAL-003-B: Ошибка для нуля', async () => {
        await validationPage.fillNumberField(0); // минимум 1
        await validationPage.validateAll();

        await validationPage.expectFieldError('numberField');
      });

      test('NVAL-003-C: Принятие значения в диапазоне', async () => {
        await validationPage.fillNumberField(50);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('numberField');
      });

      test('NVAL-003-D: Принятие граничных значений', async () => {
        await validationPage.fillNumberField(1);
        await validationPage.validateAll();
        await validationPage.expectNoFieldError('numberField');

        await validationPage.fillNumberField(100);
        await validationPage.validateAll();
        await validationPage.expectNoFieldError('numberField');
      });
    });
  });

  test.describe('Валидаторы дат', () => {
    test.describe('DVAL-001: Дата в прошлом (pastDate)', () => {
      test('DVAL-001-A: Ошибка для даты в будущем', async () => {
        await validationPage.fillDateField('2030-01-01');
        await validationPage.validateAll();

        await validationPage.expectFieldError('dateField', /не может быть в будущем/i);
      });

      test('DVAL-001-B: Принятие даты в прошлом', async () => {
        await validationPage.fillDateField('2020-01-01');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('dateField');
      });

      test('DVAL-001-C: Принятие сегодняшней даты', async () => {
        const today = new Date().toISOString().split('T')[0];
        await validationPage.fillDateField(today);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('dateField');
      });
    });

    test.describe('DVAL-002: Валидная дата (isDate)', () => {
      test('DVAL-002-A: Ошибка для пустой даты', async () => {
        await validationPage.input('isDateField').focus();
        await validationPage.validateAll();

        await validationPage.expectFieldError('isDateField', /обязательна|корректную дату/i);
      });

      test('DVAL-002-B: Принятие валидной даты', async () => {
        await validationPage.fillIsDateField('2024-06-15');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('isDateField');
      });
    });

    test.describe('DVAL-003: Минимальная дата (minDate)', () => {
      test('DVAL-003-A: Ошибка для даты раньше минимума', async () => {
        await validationPage.fillMinDateField('2019-01-01'); // минимум 2020-01-01
        await validationPage.validateAll();

        await validationPage.expectFieldError('minDateField', /раньше 01.01.2020/i);
      });

      test('DVAL-003-B: Принятие минимальной даты', async () => {
        await validationPage.fillMinDateField('2020-01-01');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minDateField');
      });

      test('DVAL-003-C: Принятие даты после минимума', async () => {
        await validationPage.fillMinDateField('2022-06-15');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minDateField');
      });
    });

    test.describe('DVAL-004: Максимальная дата (maxDate)', () => {
      test('DVAL-004-A: Ошибка для даты позже максимума', async () => {
        await validationPage.fillMaxDateField('2030-01-01'); // максимум сегодня
        await validationPage.validateAll();

        await validationPage.expectFieldError('maxDateField', /позже сегодня/i);
      });

      test('DVAL-004-B: Принятие даты до сегодня', async () => {
        await validationPage.fillMaxDateField('2020-01-01');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxDateField');
      });

      test('DVAL-004-C: Принятие сегодняшней даты', async () => {
        const today = new Date().toISOString().split('T')[0];
        await validationPage.fillMaxDateField(today);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxDateField');
      });
    });

    test.describe('DVAL-005: Дата в будущем (futureDate)', () => {
      test('DVAL-005-A: Ошибка для даты в прошлом', async () => {
        await validationPage.fillFutureDateField('2020-01-01');
        await validationPage.validateAll();

        await validationPage.expectFieldError('futureDateField', /в будущем/i);
      });

      test('DVAL-005-B: Принятие даты в будущем', async () => {
        await validationPage.fillFutureDateField('2030-01-01');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('futureDateField');
      });
    });

    test.describe('DVAL-006: Минимальный возраст (minAge)', () => {
      test('DVAL-006-A: Ошибка для возраста ниже минимума', async () => {
        // Дата, при которой человеку меньше 18
        const youngDate = new Date();
        youngDate.setFullYear(youngDate.getFullYear() - 15);
        const dateStr = youngDate.toISOString().split('T')[0];

        await validationPage.fillMinAgeField(dateStr);
        await validationPage.validateAll();

        await validationPage.expectFieldError('minAgeField', /минимальный возраст.*18/i);
      });

      test('DVAL-006-B: Принятие минимального возраста', async () => {
        // Дата, при которой человеку ровно 18 (с запасом в день для граничного случая)
        const minAgeDate = new Date();
        minAgeDate.setFullYear(minAgeDate.getFullYear() - 18);
        minAgeDate.setDate(minAgeDate.getDate() - 1); // На день раньше для полных 18 лет
        const dateStr = minAgeDate.toISOString().split('T')[0];

        await validationPage.fillMinAgeField(dateStr);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minAgeField');
      });

      test('DVAL-006-C: Принятие возраста выше минимума', async () => {
        // Дата, при которой человеку 30 лет
        const adultDate = new Date();
        adultDate.setFullYear(adultDate.getFullYear() - 30);
        const dateStr = adultDate.toISOString().split('T')[0];

        await validationPage.fillMinAgeField(dateStr);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('minAgeField');
      });
    });

    test.describe('DVAL-007: Максимальный возраст (maxAge)', () => {
      test('DVAL-007-A: Ошибка для возраста выше максимума', async () => {
        // Дата, при которой человеку больше 65
        const oldDate = new Date();
        oldDate.setFullYear(oldDate.getFullYear() - 70);
        const dateStr = oldDate.toISOString().split('T')[0];

        await validationPage.fillMaxAgeField(dateStr);
        await validationPage.validateAll();

        await validationPage.expectFieldError('maxAgeField', /максимальный возраст.*65/i);
      });

      test('DVAL-007-B: Принятие максимального возраста', async () => {
        // Дата, при которой человеку ровно 65
        const maxAgeDate = new Date();
        maxAgeDate.setFullYear(maxAgeDate.getFullYear() - 65);
        const dateStr = maxAgeDate.toISOString().split('T')[0];

        await validationPage.fillMaxAgeField(dateStr);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxAgeField');
      });

      test('DVAL-007-C: Принятие возраста ниже максимума', async () => {
        // Дата, при которой человеку 40 лет
        const middleAgeDate = new Date();
        middleAgeDate.setFullYear(middleAgeDate.getFullYear() - 40);
        const dateStr = middleAgeDate.toISOString().split('T')[0];

        await validationPage.fillMaxAgeField(dateStr);
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('maxAgeField');
      });
    });
  });

  test.describe('Кастомные валидаторы', () => {
    test.describe('CVAL-001: Кастомный валидатор пароля', () => {
      test('CVAL-001-A: Ошибка для короткого пароля', async () => {
        await validationPage.fillCustomField('Pass1'); // < 8 символов
        await validationPage.validateAll();

        await validationPage.expectFieldError('customField', /минимум 8/i);
      });

      test('CVAL-001-B: Ошибка для пароля без цифры', async () => {
        await validationPage.fillCustomField('Password'); // нет цифры
        await validationPage.validateAll();

        await validationPage.expectFieldError('customField', /цифра/i);
      });

      test('CVAL-001-C: Ошибка для пароля без буквы', async () => {
        await validationPage.fillCustomField('12345678'); // нет буквы
        await validationPage.validateAll();

        await validationPage.expectFieldError('customField', /буква/i);
      });

      test('CVAL-001-D: Принятие валидного пароля', async () => {
        await validationPage.fillCustomField('Password1');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('customField');
      });

      test('CVAL-001-E: Принятие сложного пароля', async () => {
        await validationPage.fillCustomField('SecureP@ss123');
        await validationPage.validateAll();

        await validationPage.expectNoFieldError('customField');
      });
    });
  });

  test.describe('FORM-001: Кнопка валидации всех полей', () => {
    test('FORM-001-A: Валидация всех полей одновременно', async () => {
      // Оставляем все поля пустыми
      await validationPage.validateAll();

      // Обязательные поля должны показать ошибки (max/min/number валидируют только при наличии значения)
      await validationPage.expectFieldError('requiredField');
      await validationPage.expectFieldError('emailField');
      await validationPage.expectFieldError('minLengthField');
      await validationPage.expectFieldError('patternField');
      await validationPage.expectFieldError('urlField');
      await validationPage.expectFieldError('phoneField');
    });

    test('FORM-001-B: Очистка всех ошибок при сбросе', async () => {
      // Вызываем ошибки
      await validationPage.validateAll();

      // Сбрасываем
      await validationPage.reset();

      // Ошибки должны быть очищены
      await validationPage.expectNoFieldError('requiredField');
      await validationPage.expectNoFieldError('emailField');
    });
  });

  test.describe('FORM-002: Восстановление после ошибок', () => {
    test('FORM-002-A: Очистка ошибки при вводе валидного значения', async () => {
      // Создаём ошибку
      await validationPage.fillEmailField('invalid');
      await validationPage.validateAll();
      await validationPage.expectFieldError('emailField');

      // Исправляем валидным значением
      await validationPage.fillEmailField('valid@example.com');
      await validationPage.validateAll();
      await validationPage.expectNoFieldError('emailField');
    });

    test('FORM-002-B: Разные ошибки при разных нарушениях валидации', async () => {
      // Первая ошибка - обязательное поле
      await validationPage.input('emailField').focus();
      await validationPage.validateAll();
      await validationPage.expectFieldError('emailField', /обязателен/i);

      // Другая ошибка - формат
      await validationPage.fillEmailField('invalid');
      await validationPage.validateAll();
      await validationPage.expectFieldError('emailField', /корректный email/i);
    });
  });

  test.describe('FORM-003: Переключение секций', () => {
    test('FORM-003-A: Сворачивание и разворачивание секций', async () => {
      await validationPage.collapseAllSections();

      // Поля в свёрнутых секциях не должны быть видимы
      await expect(validationPage.input('requiredField')).not.toBeVisible();

      await validationPage.expandAllSections();

      // Поля должны быть видимы снова
      await expect(validationPage.input('requiredField')).toBeVisible();
    });
  });
});
