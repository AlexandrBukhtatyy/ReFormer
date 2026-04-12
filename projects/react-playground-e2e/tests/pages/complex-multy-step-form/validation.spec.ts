/**
 * Validation E2E Tests
 *
 * Тесты валидации полей формы:
 * - Обязательные поля
 * - Форматы данных (email, телефон, ИНН и т.д.)
 * - Граничные значения
 * - Кросс-полевая валидация
 */

import { test, expect } from '../../shared/test-factory';
import { INVALID_DATA, VALID_SMS_CODE } from './test-data';

test.describe('Validation', { tag: ['@validation'] }, () => {
  test.describe('VAL-001: Обязательные поля', () => {
    test('VAL-001-A: Блокировка перехода при пустых обязательных полях на шаге 1', async ({
      creditForm,
    }) => {
      await creditForm.goto();

      // Очищаем предзаполненные поля
      await creditForm.input('loanAmount').clear();
      await creditForm.input('loanTerm').clear();
      await creditForm.input('loanPurpose').clear();

      // Пытаемся перейти на следующий шаг
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1
      await creditForm.expectStepHeading(/основная информация о кредите/i);

      // Проверяем наличие ошибок валидации
      await creditForm.expectFieldError('loanAmount', /укажите сумму/i);
      await creditForm.expectFieldError('loanTerm', /укажите срок/i);
      await creditForm.expectFieldError('loanPurpose', /укажите цель/i);
    });

    test('VAL-001-B: Обязательные поля на шаге 2 (персональные данные)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Очищаем предзаполненные данные
      await creditForm.input('personalData-lastName').clear();
      await creditForm.input('personalData-firstName').clear();

      // Пытаемся перейти дальше
      await creditForm.goToNextStep();

      // Проверяем ошибки
      await creditForm.expectFieldError('personalData-lastName', /фамилия обязательна/i);
      await creditForm.expectFieldError('personalData-firstName', /имя обязательно/i);
    });

    test('VAL-001-C: Обязательные согласия на шаге 6', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      // Пытаемся отправить форму без согласий
      await creditForm.submitForm();

      // Проверяем ошибки обязательных согласий
      await creditForm.expectFieldError('agreePersonalData', /согласие.*обязательно/i);
      await creditForm.expectFieldError('agreeCreditHistory', /согласие.*обязательно/i);
      await creditForm.expectFieldError('agreeTerms', /согласие.*обязательно/i);
      await creditForm.expectFieldError('confirmAccuracy', /подтверждение.*обязательно/i);
    });
  });

  test.describe('VAL-002: Валидация Email', () => {
    test('VAL-002-A: Невалидный формат email', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Вводим невалидный email
      await creditForm.fillEmail(INVALID_DATA.invalidEmail);

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 3 с ошибкой
      await creditForm.expectStepHeading(/контактная информация/i);
      await creditForm.expectFieldError('email');
    });

    test('VAL-002-B: Валидный формат email', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      await creditForm.fillEmail('valid@example.com');
      await creditForm.input('email').blur();

      await creditForm.expectNoFieldError('email');
    });

    test('VAL-002-C: Дополнительный email не может совпадать с основным', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      const sameEmail = 'test@example.com';
      await creditForm.fillEmail(sameEmail);
      await creditForm.fillPhone('+7 (999) 123-45-67');
      await creditForm.input('emailAdditional').fill(sameEmail);

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 3 с ошибкой
      await creditForm.expectStepHeading(/контактная информация/i);
      await creditForm.expectFieldError('emailAdditional', /должен отличаться/i);
    });
  });

  test.describe('VAL-003: Валидация телефона с маской', () => {
    test('VAL-003-A: Неполный номер телефона', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Заполняем остальные обязательные поля шага 3
      await creditForm.fillEmail('test@example.com');

      // Вводим неполный телефон
      await creditForm.input('phoneMain').fill('+7 (999) 123');

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 3 с ошибкой
      await creditForm.expectStepHeading(/контактная информация/i);
      await creditForm.expectFieldError('phoneMain');
    });

    test('VAL-003-B: Полный валидный номер телефона', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      await creditForm.fillPhone('+7 (999) 123-45-67');
      await creditForm.input('phoneMain').blur();

      await creditForm.expectNoFieldError('phoneMain');
    });

    test('VAL-003-C: Дополнительный телефон не может совпадать с основным', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      const samePhone = '+7 (999) 123-45-67';
      await creditForm.fillEmail('test@example.com');
      await creditForm.fillPhone(samePhone);
      await creditForm.input('phoneAdditional').fill(samePhone);

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 3 с ошибкой
      await creditForm.expectStepHeading(/контактная информация/i);
      await creditForm.expectFieldError('phoneAdditional', /должен отличаться/i);
    });
  });

  test.describe('VAL-004: Валидация возраста (18-70 лет)', () => {
    test('VAL-004-A: Возраст меньше 18 лет', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Заполняем данные с датой рождения < 18 лет назад
      const today = new Date();
      const youngBirthDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
      const formattedDate = youngBirthDate.toISOString().split('T')[0];

      // Заполняем все обязательные поля шага 2, но с невалидной датой рождения
      await creditForm.fillLastName('Иванов');
      await creditForm.fillFirstName('Иван');
      await creditForm.fillMiddleName('Иванович');
      await creditForm.fillBirthDate(formattedDate);
      await creditForm.selectGender('male');
      await creditForm.fillBirthPlace('г. Москва');
      await creditForm.fillPassportSeries('45 06');
      await creditForm.fillPassportNumber('123456');
      await creditForm.fillPassportIssuedBy('ОВД Центрального района');
      await creditForm.fillPassportIssuedDate('2020-01-15');
      await creditForm.fillPassportCode('770-001');
      await creditForm.fillInn('123456789012');
      await creditForm.fillSnils('123-456-789 01');

      // Попытка перехода должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 2 с ошибкой
      await creditForm.expectStepHeading(/персональные данные/i);
      await creditForm.expectFieldError('personalData-birthDate');
    });

    test('VAL-004-B: Возраст больше 70 лет', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Заполняем данные с датой рождения > 70 лет назад
      const today = new Date();
      const oldBirthDate = new Date(today.getFullYear() - 75, today.getMonth(), today.getDate());
      const formattedDate = oldBirthDate.toISOString().split('T')[0];

      // Заполняем все обязательные поля шага 2, но с невалидной датой рождения
      await creditForm.fillLastName('Иванов');
      await creditForm.fillFirstName('Иван');
      await creditForm.fillMiddleName('Иванович');
      await creditForm.fillBirthDate(formattedDate);
      await creditForm.selectGender('male');
      await creditForm.fillBirthPlace('г. Москва');
      await creditForm.fillPassportSeries('45 06');
      await creditForm.fillPassportNumber('123456');
      await creditForm.fillPassportIssuedBy('ОВД Центрального района');
      await creditForm.fillPassportIssuedDate('1975-01-15');
      await creditForm.fillPassportCode('770-001');
      await creditForm.fillInn('123456789012');
      await creditForm.fillSnils('123-456-789 01');

      // Попытка перехода должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 2 с ошибкой
      await creditForm.expectStepHeading(/персональные данные/i);
      await creditForm.expectFieldError('personalData-birthDate');
    });

    test('VAL-004-C: Валидный возраст (30 лет)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      const today = new Date();
      const validBirthDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
      const formattedDate = validBirthDate.toISOString().split('T')[0];

      await creditForm.fillBirthDate(formattedDate);
      await creditForm.input('personalData-birthDate').blur();

      await creditForm.expectNoFieldError('personalData-birthDate');
    });
  });

  test.describe('VAL-005: Cross-field валидация', () => {
    test('VAL-005-A: Первоначальный взнос не может превышать стоимость недвижимости', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      await creditForm.fillPropertyValue(5000000);
      await creditForm.input('initialPayment').fill('6000000');
      await creditForm.fillLoanTerm(240);
      await creditForm.fillLoanPurpose('Покупка квартиры');

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1 с ошибкой
      await creditForm.expectStepHeading(/основная информация/i);
      await creditForm.expectFieldError('initialPayment', /не может превышать/i);
    });

    test('VAL-005-B: Первоначальный взнос должен быть минимум 20% от стоимости', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      await creditForm.fillPropertyValue(5000000);
      await creditForm.input('initialPayment').fill('500000'); // 10%
      await creditForm.fillLoanTerm(240);
      await creditForm.fillLoanPurpose('Покупка квартиры');

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1 с ошибкой
      await creditForm.expectStepHeading(/основная информация/i);
      await creditForm.expectFieldError('initialPayment', /меньше 20%|минимум 20%/i);
    });

    test('VAL-005-C: Стаж на текущем месте не может превышать общий стаж', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Тест Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
      await creditForm.fillPosition('Менеджер');

      await creditForm.fillWorkExperience(24); // 2 года общий
      await creditForm.fillCurrentJobExperience(36); // 3 года на текущем месте (невалидно)
      await creditForm.fillMonthlyIncome(100000);

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 4 с ошибкой
      await creditForm.expectStepHeading(/информация о занятости/i);
      await creditForm.expectFieldError('workExperienceCurrent', /не может превышать общий/i);
    });

    test('VAL-005-D: Платеж не должен превышать 50% от дохода (warning)', async ({ creditForm }) => {
      await creditForm.goto();

      // Заполняем большую сумму кредита
      await creditForm.fillLoanAmount(5000000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Тестовая цель кредита');
      await creditForm.goToNextStep();

      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      // Указываем низкий доход
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Тест Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
      await creditForm.fillPosition('Менеджер');
      await creditForm.fillWorkExperience(60);
      await creditForm.fillCurrentJobExperience(24);
      await creditForm.fillMonthlyIncome(50000); // Низкий доход для большого кредита

      // Попытка перехода на следующий шаг
      await creditForm.goToNextStep();

      // Это warning, а не блокирующая ошибка - форма может пропустить на следующий шаг
      // Тест проверяет что валидация не блокирует навигацию (warning != error)
      await creditForm.expectStepHeading(/дополнительная информация/i);
    });

    test('VAL-005-E: При дополнительном доходе требуется указать источник', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Тест Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
      await creditForm.fillPosition('Менеджер');
      await creditForm.fillWorkExperience(60);
      await creditForm.fillCurrentJobExperience(24);
      await creditForm.fillMonthlyIncome(100000);
      await creditForm.fillAdditionalIncome(50000);

      // Пытаемся перейти дальше без указания источника
      await creditForm.goToNextStep();

      // Должны остаться на шаге 4 с ошибкой
      await creditForm.expectStepHeading(/информация о занятости/i);
      await creditForm.expectFieldError('additionalIncomeSource', /укажите источник/i);
    });
  });

  test.describe('VAL-006: Валидация границ значений', () => {
    test('VAL-006-A: Сумма кредита меньше минимума (50000)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillLoanAmount(INVALID_DATA.loanAmountTooLow);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Покупка товаров для дома');

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1 с ошибкой
      await creditForm.expectStepHeading(/основная информация/i);
      await creditForm.expectFieldError('loanAmount', /минимальная сумма|50.*000/i);
    });

    test('VAL-006-B: Сумма кредита больше максимума (10000000)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillLoanAmount(INVALID_DATA.loanAmountTooHigh);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Покупка товаров для дома');

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1 с ошибкой
      await creditForm.expectStepHeading(/основная информация/i);
      await creditForm.expectFieldError('loanAmount', /максимальная сумма|10.*000.*000/i);
    });

    test('VAL-006-C: Срок кредита меньше минимума (6 месяцев)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(INVALID_DATA.loanTermTooShort);
      await creditForm.fillLoanPurpose('Покупка товаров для дома');

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1 с ошибкой
      await creditForm.expectStepHeading(/основная информация/i);
      await creditForm.expectFieldError('loanTerm', /минимальный срок|6 месяц/i);
    });

    test('VAL-006-D: Срок кредита больше максимума (240 месяцев)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(INVALID_DATA.loanTermTooLong);
      await creditForm.fillLoanPurpose('Покупка товаров для дома');

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1 с ошибкой
      await creditForm.expectStepHeading(/основная информация/i);
      await creditForm.expectFieldError('loanTerm', /максимальный срок|240/i);
    });

    test('VAL-006-E: Цель кредита слишком короткая', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose(INVALID_DATA.loanPurposeTooShort);

      // Попытка перехода на следующий шаг должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 1 с ошибкой
      await creditForm.expectStepHeading(/основная информация/i);
      await creditForm.expectFieldError('loanPurpose', /минимум 10|подробнее/i);
    });
  });

  test.describe('VAL-007: Валидация SMS кода', () => {
    test('VAL-007-A: Неполный SMS код', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();

      await creditForm.fillSmsCode(INVALID_DATA.incompleteSmsCode);

      // Попытка отправки формы должна вызвать валидацию
      await creditForm.submitForm();

      // Должны остаться на шаге 6 с ошибкой
      await creditForm.expectStepHeading(/подтверждение/i);
      await creditForm.expectFieldError('electronicSignature', /6 символов|введите код/i);
    });

    test('VAL-007-B: Неверный SMS код', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();

      await creditForm.fillSmsCode('000000'); // Неверный код
      // Ждем асинхронную валидацию (debounce 500ms)
      await creditForm.page.waitForTimeout(700);

      // Попытка отправки формы
      await creditForm.submitForm();

      // Должна появиться ошибка неверного кода
      await creditForm.expectFieldError('electronicSignature', /неверный код|invalid/i);
    });

    test('VAL-007-C: Верный SMS код (123456)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();

      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await creditForm.page.waitForTimeout(700);

      await creditForm.expectNoFieldError('electronicSignature');
    });
  });
});
