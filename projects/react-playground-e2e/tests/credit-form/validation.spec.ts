import { test } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';
import { INVALID_DATA, VALID_SMS_CODE } from '../fixtures/test-data';

test.describe('Валидация полей', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  // ============================================================================
  // Шаг 1: Валидация параметров кредита
  // ============================================================================

  test.describe('Шаг 1: Параметры кредита', () => {
    /**
     * TC-VAL-001: Блокировка перехода при пустых обязательных полях
     * Приоритет: Critical
     */
    test(
      'TC-VAL-001: Блокировка перехода при пустых обязательных полях',
      {
        tag: ['@critical', '@validation'],
      },
      async () => {
        // Очищаем поле суммы кредита (оставляем пустым)
        await creditForm.fillLoanAmount(0);
        await creditForm.input('loanAmount').clear();

        // Пытаемся перейти на следующий шаг
        await creditForm.goToNextStep();

        // Проверяем что остались на шаге 1
        await creditForm.expectStepHeading(/основная информация о кредите/i);

        // Проверяем отображение ошибки
        await creditForm.expectFieldError('loanAmount');
      }
    );

    /**
     * TC-VAL-002: Валидация минимальной суммы кредита
     * Приоритет: High
     */
    test(
      'TC-VAL-002: Валидация минимальной суммы кредита',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        await creditForm.fillLoanAmount(INVALID_DATA.loanAmountTooLow);
        await creditForm.goToNextStep();

        await creditForm.expectStepHeading(/основная информация о кредите/i);
        await creditForm.expectFieldError('loanAmount', /минимальная сумма|min/i);
      }
    );

    /**
     * TC-VAL-003: Валидация максимальной суммы кредита
     * Приоритет: High
     */
    test(
      'TC-VAL-003: Валидация максимальной суммы кредита',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        await creditForm.fillLoanAmount(INVALID_DATA.loanAmountTooHigh);
        await creditForm.goToNextStep();

        await creditForm.expectStepHeading(/основная информация о кредите/i);
        await creditForm.expectFieldError('loanAmount', /максимальная сумма|max/i);
      }
    );

    /**
     * TC-VAL-004: Валидация минимального срока кредита
     * Приоритет: High
     */
    test(
      'TC-VAL-004: Валидация минимального срока кредита',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        await creditForm.fillLoanAmount(500000);
        await creditForm.fillLoanTerm(INVALID_DATA.loanTermTooShort);
        await creditForm.fillLoanPurpose('Ремонт квартиры');
        await creditForm.goToNextStep();

        await creditForm.expectStepHeading(/основная информация о кредите/i);
        await creditForm.expectFieldError('loanTerm', /минимальный срок|min/i);
      }
    );

    /**
     * TC-VAL-005: Валидация максимального срока кредита
     * Приоритет: High
     */
    test(
      'TC-VAL-005: Валидация максимального срока кредита',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        await creditForm.fillLoanAmount(500000);
        await creditForm.fillLoanTerm(INVALID_DATA.loanTermTooLong);
        await creditForm.fillLoanPurpose('Ремонт квартиры');
        await creditForm.goToNextStep();

        await creditForm.expectStepHeading(/основная информация о кредите/i);
        await creditForm.expectFieldError('loanTerm', /максимальный срок|max/i);
      }
    );

    /**
     * TC-VAL-006: Валидация минимальной длины цели кредита
     * Приоритет: Medium
     */
    test(
      'TC-VAL-006: Валидация минимальной длины цели кредита',
      {
        tag: ['@medium', '@validation'],
      },
      async () => {
        await creditForm.fillLoanAmount(500000);
        await creditForm.fillLoanTerm(24);
        await creditForm.fillLoanPurpose(INVALID_DATA.loanPurposeTooShort);
        await creditForm.goToNextStep();

        await creditForm.expectStepHeading(/основная информация о кредите/i);
        await creditForm.expectFieldError('loanPurpose', /минимальная длина|символов/i);
      }
    );
  });

  // ============================================================================
  // Шаг 2: Валидация персональных данных
  // ============================================================================

  test.describe('Шаг 2: Персональные данные', () => {
    test.beforeEach(async () => {
      // Переходим на шаг 2
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Ремонт квартиры');
      await creditForm.goToNextStep();
      await creditForm.expectStepHeading(/персональные данные/i);
    });

    /**
     * TC-VAL-009: Валидация формата ИНН
     * Приоритет: High
     */
    test(
      'TC-VAL-009: Валидация формата ИНН (12 цифр)',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        // Заполняем все обязательные поля шага 2 с невалидным ИНН
        await creditForm.fillLastName('Иванов');
        await creditForm.fillFirstName('Иван');
        await creditForm.fillMiddleName('Иванович');
        await creditForm.fillBirthDate('1990-05-15');
        await creditForm.selectGender('male');
        await creditForm.fillBirthPlace('г. Москва');
        await creditForm.fillPassportSeries('45 06');
        await creditForm.fillPassportNumber('123456');
        await creditForm.fillPassportIssuedBy('ОВД Центрального района г. Москвы');
        await creditForm.fillPassportIssuedDate('2010-06-20');
        await creditForm.fillPassportCode('770-001');
        await creditForm.fillInn(INVALID_DATA.incompleteInn); // Невалидный ИНН
        await creditForm.fillSnils('123-456-789 01');

        await creditForm.goToNextStep();

        // Должны остаться на шаге 2 с ошибкой ИНН
        await creditForm.expectStepHeading(/персональные данные/i);
        await creditForm.expectFieldError('inn', /12 цифр/i);
      }
    );

    /**
     * TC-VAL-010: Валидация формата СНИЛС
     * Приоритет: High
     */
    test(
      'TC-VAL-010: Валидация формата СНИЛС',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        // Заполняем все обязательные поля шага 2 с невалидным СНИЛС
        await creditForm.fillLastName('Иванов');
        await creditForm.fillFirstName('Иван');
        await creditForm.fillMiddleName('Иванович');
        await creditForm.fillBirthDate('1990-05-15');
        await creditForm.selectGender('male');
        await creditForm.fillBirthPlace('г. Москва');
        await creditForm.fillPassportSeries('45 06');
        await creditForm.fillPassportNumber('123456');
        await creditForm.fillPassportIssuedBy('ОВД Центрального района г. Москвы');
        await creditForm.fillPassportIssuedDate('2010-06-20');
        await creditForm.fillPassportCode('770-001');
        await creditForm.fillInn('123456789012');
        await creditForm.fillSnils(INVALID_DATA.incompleteSnils); // Невалидный СНИЛС

        await creditForm.goToNextStep();

        // Должны остаться на шаге 2 с ошибкой СНИЛС
        await creditForm.expectStepHeading(/персональные данные/i);
        await creditForm.expectFieldError('snils', /формат|СНИЛС/i);
      }
    );

    /**
     * TC-VAL-011: Валидация серии паспорта
     * Приоритет: High
     */
    test(
      'TC-VAL-011: Валидация серии паспорта',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        // Заполняем все обязательные поля шага 2 с невалидной серией паспорта
        await creditForm.fillLastName('Иванов');
        await creditForm.fillFirstName('Иван');
        await creditForm.fillMiddleName('Иванович');
        await creditForm.fillBirthDate('1990-05-15');
        await creditForm.selectGender('male');
        await creditForm.fillBirthPlace('г. Москва');
        await creditForm.fillPassportSeries(INVALID_DATA.incompletePassportSeries); // Невалидная серия
        await creditForm.fillPassportNumber('123456');
        await creditForm.fillPassportIssuedBy('ОВД Центрального района г. Москвы');
        await creditForm.fillPassportIssuedDate('2010-06-20');
        await creditForm.fillPassportCode('770-001');
        await creditForm.fillInn('123456789012');
        await creditForm.fillSnils('123-456-789 01');

        await creditForm.goToNextStep();

        // Должны остаться на шаге 2 с ошибкой серии паспорта
        await creditForm.expectStepHeading(/персональные данные/i);
        await creditForm.expectFieldError('passportData-series', /формат/i);
      }
    );

    /**
     * TC-VAL-012: Валидация кода подразделения
     * Приоритет: Medium
     */
    test(
      'TC-VAL-012: Валидация кода подразделения',
      {
        tag: ['@medium', '@validation'],
      },
      async () => {
        // Заполняем все обязательные поля шага 2 с невалидным кодом подразделения
        await creditForm.fillLastName('Иванов');
        await creditForm.fillFirstName('Иван');
        await creditForm.fillMiddleName('Иванович');
        await creditForm.fillBirthDate('1990-05-15');
        await creditForm.selectGender('male');
        await creditForm.fillBirthPlace('г. Москва');
        await creditForm.fillPassportSeries('45 06');
        await creditForm.fillPassportNumber('123456');
        await creditForm.fillPassportIssuedBy('ОВД Центрального района г. Москвы');
        await creditForm.fillPassportIssuedDate('2010-06-20');
        await creditForm.fillPassportCode(INVALID_DATA.incompletePassportCode); // Невалидный код
        await creditForm.fillInn('123456789012');
        await creditForm.fillSnils('123-456-789 01');

        await creditForm.goToNextStep();

        // Должны остаться на шаге 2 с ошибкой кода подразделения
        await creditForm.expectStepHeading(/персональные данные/i);
        await creditForm.expectFieldError('passportData-departmentCode', /формат/i);
      }
    );
  });

  // ============================================================================
  // Шаг 3: Валидация контактной информации
  // ============================================================================

  test.describe('Шаг 3: Контактная информация', () => {
    test.beforeEach(async () => {
      // Переходим на шаг 3 с заполненными шагами 1 и 2
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.expectStepHeading(/контактная информация/i);
    });

    /**
     * TC-VAL-007: Валидация формата email
     * Приоритет: High
     */
    test(
      'TC-VAL-007: Валидация формата email',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        // Заполняем все поля шага 3 с невалидным email
        await creditForm.fillPhone('+7 (999) 123-45-67');
        await creditForm.fillEmail(INVALID_DATA.invalidEmail); // Невалидный email
        await creditForm.fillRegion('Московская область');
        await creditForm.fillCity('Москва');
        await creditForm.fillStreet('Тверская');
        await creditForm.fillHouse('1');
        await creditForm.fillApartment('10');
        await creditForm.fillPostalCode('123456');

        await creditForm.goToNextStep();

        // Должны остаться на шаге 3 с ошибкой email
        await creditForm.expectStepHeading(/контактная информация/i);
        await creditForm.expectFieldError('email', /email|формат/i);
      }
    );

    /**
     * TC-VAL-008: Валидация маски телефона
     * Приоритет: High
     */
    test(
      'TC-VAL-008: Валидация маски телефона',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        // Заполняем все поля шага 3 с невалидным телефоном
        await creditForm.fillPhone(INVALID_DATA.incompletePhone); // Невалидный телефон
        await creditForm.fillEmail('test@example.com');
        await creditForm.fillRegion('Московская область');
        await creditForm.fillCity('Москва');
        await creditForm.fillStreet('Тверская');
        await creditForm.fillHouse('1');
        await creditForm.fillApartment('10');
        await creditForm.fillPostalCode('123456');

        await creditForm.goToNextStep();

        // Должны остаться на шаге 3 с ошибкой телефона
        await creditForm.expectStepHeading(/контактная информация/i);
        await creditForm.expectFieldError('phoneMain', /формат/i);
      }
    );
  });

  // ============================================================================
  // Шаг 4: Валидация занятости и дохода
  // ============================================================================

  test.describe('Шаг 4: Занятость и доход', () => {
    test.beforeEach(async () => {
      // Быстрый переход на шаг 4
      for (let i = 0; i < 3; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-VAL-013: Валидация минимального дохода
     * Приоритет: High
     */
    test(
      'TC-VAL-013: Валидация минимального дохода',
      {
        tag: ['@high', '@validation'],
      },
      async () => {
        await creditForm.fillMonthlyIncome(INVALID_DATA.incomeTooLow);
        await creditForm.goToNextStep();

        await creditForm.expectFieldError('monthlyIncome', /минимальный доход|min/i);
      }
    );
  });

  // ============================================================================
  // Шаг 6: Валидация подтверждения
  // ============================================================================

  test.describe('Шаг 6: Подтверждение', () => {
    test.beforeEach(async () => {
      // Заполняем и переходим на шаг 6 с валидными данными
      await creditForm.fillAndNavigateToStep6();
      await creditForm.expectStepHeading(/подтверждение/i);
    });

    /**
     * TC-VAL-014: Валидация обязательных согласий
     * Приоритет: Critical
     */
    test(
      'TC-VAL-014: Валидация обязательных согласий на шаге 6',
      {
        tag: ['@critical', '@validation'],
      },
      async () => {
        // Не отмечаем согласия и пытаемся отправить
        await creditForm.fillSmsCode(VALID_SMS_CODE);
        await creditForm.submitForm();

        // Проверяем что отправка заблокирована - ошибка на чекбоксах согласий
        await creditForm.expectFieldError('agreePersonalData');
      }
    );

    /**
     * TC-VAL-015: Валидация SMS-кода
     * Приоритет: Critical
     */
    test(
      'TC-VAL-015: Валидация SMS-кода',
      {
        tag: ['@critical', '@validation'],
      },
      async () => {
        await creditForm.acceptPersonalDataAgreement();
        await creditForm.acceptCreditHistoryAgreement();
        await creditForm.acceptTermsAgreement();

        // Вводим неполный SMS-код
        await creditForm.fillSmsCode(INVALID_DATA.incompleteSmsCode);
        await creditForm.submitForm();

        // Проверяем ошибку
        await creditForm.expectFieldError('electronicSignature', /неполный|6 цифр|символов/i);
      }
    );
  });
});
