/**
 * E2E-тесты happy path
 *
 * Тесты полного успешного прохождения формы для разных типов кредита.
 * Проверяют, что пользователь может заполнить форму от начала до конца
 * и успешно отправить заявку.
 */

import { test, expect } from '../../shared/test-factory';
import { CONSUMER_LOAN_DATA, MORTGAGE_LOAN_DATA, CAR_LOAN_DATA, VALID_SMS_CODE } from './test-data';
import {
  mockSubmitApplicationApi,
  mockCreditApplicationApi,
  mockDictionariesApi,
  mockRegionsApi,
  mockCitiesApi,
  mockAllApisForHappyPath,
  MOCK_CREDIT_APPLICATION_1,
} from './mocks';

test.describe('Happy Path — успешное прохождение формы', { tag: ['@critical', '@smoke'] }, () => {
  test('HP-001: Потребительский кредит - полное заполнение', async ({ creditForm }) => {
    await test.step('Открываем форму', async () => {
      await creditForm.goto();
      await creditForm.expectStepHeading(/основная информация о кредите/i);
    });

    await test.step('Шаг 1: Заполняем информацию о кредите', async () => {
      // Тип кредита по умолчанию - потребительский
      await creditForm.fillLoanAmount(CONSUMER_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(CONSUMER_LOAN_DATA.loanTerm);
      await creditForm.fillLoanPurpose(CONSUMER_LOAN_DATA.loanPurpose);
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 2: Заполняем персональные данные', async () => {
      await creditForm.expectStepHeading(/персональные данные/i);
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 3: Заполняем контактную информацию', async () => {
      await creditForm.expectStepHeading(/контактная информация/i);
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 4: Заполняем информацию о занятости', async () => {
      await creditForm.expectStepHeading(/информация о занятости/i);
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 5: Заполняем дополнительную информацию', async () => {
      await creditForm.expectStepHeading(/дополнительная информация/i);
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 6: Подтверждение и отправка', async () => {
      await creditForm.expectStepHeading(/подтверждение и согласия/i);

      // Принимаем все согласия
      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();

      // Вводим SMS код
      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await creditForm.page.waitForTimeout(600); // Ждем асинхронную валидацию

      // Отправляем форму
      await creditForm.submitForm();
    });

    await test.step('Проверяем успешную отправку', async () => {
      await creditForm.expectSuccessMessage();
      expect(creditForm.hasNoErrors()).toBe(true);
    });
  });

  test('HP-002: Ипотека - полное заполнение', async ({ creditForm }) => {
    await test.step('Открываем форму', async () => {
      await creditForm.goto();
    });

    await test.step('Шаг 1: Заполняем информацию об ипотеке', async () => {
      await creditForm.selectLoanType('mortgage');

      // Проверяем, что появились поля для ипотеки
      await creditForm.expectFieldVisible('propertyValue');
      await creditForm.expectFieldVisible('initialPayment');

      await creditForm.fillPropertyValue(MORTGAGE_LOAN_DATA.propertyValue);
      // initialPayment вычисляется автоматически (20% от propertyValue)
      await creditForm.page.waitForTimeout(100);
      await creditForm.fillLoanAmount(MORTGAGE_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(MORTGAGE_LOAN_DATA.loanTerm);
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 2: Заполняем персональные данные', async () => {
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 3: Заполняем контактную информацию', async () => {
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 4: Заполняем информацию о занятости', async () => {
      // Для ипотеки нужен более высокий доход
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('ООО Крупная Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Деловая, д. 1, офис 100');
      await creditForm.fillPosition('Руководитель отдела');
      await creditForm.fillWorkExperience(120); // 10 лет общего стажа
      await creditForm.fillCurrentJobExperience(48);
      await creditForm.fillMonthlyIncome(300000); // Высокий доход для ипотеки
      await creditForm.fillAdditionalIncome(0);
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 5: Заполняем дополнительную информацию', async () => {
      await creditForm.selectMaritalStatus('married');
      await creditForm.fillDependents(2);
      await creditForm.selectEducation('higher');
      await creditForm.toggleHasProperty(false);
      await creditForm.toggleHasLoans(false);
      await creditForm.toggleAddCoBorrower(false);
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 6: Подтверждение и отправка', async () => {
      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();
      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await creditForm.page.waitForTimeout(600);
      await creditForm.submitForm();
    });

    await test.step('Проверяем успешную отправку', async () => {
      await creditForm.expectSuccessMessage();
    });
  });

  test('HP-003: Автокредит - полное заполнение', async ({ creditForm }) => {
    await test.step('Открываем форму', async () => {
      await creditForm.goto();
    });

    await test.step('Шаг 1: Заполняем информацию об автокредите', async () => {
      await creditForm.selectLoanType('car');

      // Проверяем, что появились поля для автокредита
      await creditForm.expectFieldVisible('carBrand');
      await creditForm.expectFieldVisible('carModel');
      await creditForm.expectFieldVisible('carYear');
      await creditForm.expectFieldVisible('carPrice');

      // Заполняем поля автомобиля
      await creditForm.fillCarBrand(CAR_LOAN_DATA.carBrand);
      // Ждем загрузки моделей (watchField с debounce 300ms)
      await creditForm.page.waitForTimeout(500);
      await creditForm.selectCarModel(CAR_LOAN_DATA.carModel);
      await creditForm.fillCarYear(CAR_LOAN_DATA.carYear);
      await creditForm.fillCarPrice(CAR_LOAN_DATA.carPrice);

      await creditForm.fillLoanAmount(CAR_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(CAR_LOAN_DATA.loanTerm);
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 2: Заполняем персональные данные', async () => {
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 3: Заполняем контактную информацию', async () => {
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 4: Заполняем информацию о занятости', async () => {
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 5: Заполняем дополнительную информацию', async () => {
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 6: Подтверждение и отправка', async () => {
      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();
      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await creditForm.page.waitForTimeout(600);
      await creditForm.submitForm();
    });

    await test.step('Проверяем успешную отправку', async () => {
      await creditForm.expectSuccessMessage();
    });
  });

  test('HP-004: Рефинансирование - полное заполнение', async ({ creditForm }) => {
    await test.step('Открываем форму и заполняем шаг 1', async () => {
      await creditForm.goto();
      await creditForm.selectLoanType('refinancing');
      await creditForm.fillLoanAmount(800000);
      await creditForm.fillLoanTerm(48);
      await creditForm.fillLoanPurpose('Рефинансирование существующего кредита');
      await creditForm.goToNextStep();
    });

    await test.step('Заполняем шаги 2-5', async () => {
      // Шаг 2
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Шаг 3
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      // Шаг 4
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      // Шаг 5 - указываем существующий кредит
      await creditForm.selectMaritalStatus('single');
      await creditForm.fillDependents(0);
      await creditForm.selectEducation('higher');
      await creditForm.toggleHasProperty(false);
      await creditForm.toggleHasLoans(true);
      await creditForm.page.getByRole('button', { name: /добавить кредит/i }).click();
      // Заполняем информацию о существующем кредите
      await creditForm.input('existingLoan-bank').first().fill('Сбербанк');
      await creditForm.input('existingLoan-type').first().click();
      await creditForm.page.getByRole('option', { name: /потребительский/i }).click();
      await creditForm.input('existingLoan-remainingAmount').first().fill('500000');
      await creditForm.input('existingLoan-monthlyPayment').first().fill('15000');
      await creditForm.toggleAddCoBorrower(false);
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 6: Подтверждение и отправка', async () => {
      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();
      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await creditForm.page.waitForTimeout(600);
      await creditForm.submitForm();
      await creditForm.expectSuccessMessage();
    });
  });

  test('HP-005: Кредит для бизнеса - полное заполнение (ИП)', async ({ creditForm }) => {
    await test.step('Открываем форму и заполняем шаг 1', async () => {
      await creditForm.goto();
      await creditForm.selectLoanType('business');
      await creditForm.fillLoanAmount(1000000);
      await creditForm.fillLoanTerm(36);
      await creditForm.fillLoanPurpose('Развитие бизнеса и закупка оборудования');
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 2: Персональные данные', async () => {
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 3: Контактная информация', async () => {
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
    });

    await test.step('Шаг 4: Информация о занятости (ИП)', async () => {
      await creditForm.selectEmploymentStatus('selfEmployed');

      // Проверяем, что появились поля для ИП
      await creditForm.expectFieldVisible('businessType');
      await creditForm.expectFieldVisible('businessInn');
      await creditForm.expectFieldVisible('businessActivity');

      // Поля работодателя должны быть скрыты
      await creditForm.expectFieldHidden('companyName');
      await creditForm.expectFieldHidden('position');

      await creditForm.input('businessType').fill('ИП');
      await creditForm.input('businessInn').fill('123456789012');
      await creditForm.input('businessActivity').fill('Розничная торговля продуктами питания');
      await creditForm.fillMonthlyIncome(200000);
      await creditForm.goToNextStep();
    });

    await test.step('Шаги 5-6: Завершение', async () => {
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();
      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await creditForm.page.waitForTimeout(600);
      await creditForm.submitForm();
      await creditForm.expectSuccessMessage();
    });
  });

  // -------------------------------------------------------------------------
  // HP-006: Ошибка при отправке формы
  // -------------------------------------------------------------------------

  test.describe('HP-006: Ошибка при отправке формы', { tag: ['@regression'] }, () => {
    test('HP-006-A: при ошибке сервера 500 показывается сообщение об ошибке', async ({
      page,
      creditForm,
    }) => {
      // Настраиваем все API через page.route (MSW отключён в goto),
      // submit возвращает 500.
      await mockAllApisForHappyPath(page);
      await mockSubmitApplicationApi(page, { simulateError: true, errorStatus: 500 });

      await creditForm.goto({ disableMsw: true });

      // Быстро заполняем все шаги
      await creditForm.fillLoanAmount(CONSUMER_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(CONSUMER_LOAN_DATA.loanTerm);
      await creditForm.fillLoanPurpose(CONSUMER_LOAN_DATA.loanPurpose);
      await creditForm.goToNextStep();

      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();
      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await page.waitForTimeout(600);
      await creditForm.submitForm();

      // Ожидаем сообщение об ошибке через alert
      await page.waitForTimeout(1000);
      expect(
        creditForm.alertMessages.some((msg) => /ошибк|error|не удалось/i.test(msg))
      ).toBeTruthy();
    });

    test('HP-006-B: после ошибки отправки форма остаётся на шаге 6', async ({
      page,
      creditForm,
    }) => {
      await mockSubmitApplicationApi(page, { simulateError: true, errorStatus: 500 });

      await creditForm.goto();

      await creditForm.fillLoanAmount(CONSUMER_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(CONSUMER_LOAN_DATA.loanTerm);
      await creditForm.fillLoanPurpose(CONSUMER_LOAN_DATA.loanPurpose);
      await creditForm.goToNextStep();

      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();
      await creditForm.fillSmsCode(VALID_SMS_CODE);
      await page.waitForTimeout(600);
      await creditForm.submitForm();

      await page.waitForTimeout(1000);

      // Форма должна остаться на последнем шаге
      const step = await creditForm.getCurrentStep();
      expect(step).toBe(6);
    });
  });

  // -------------------------------------------------------------------------
  // HP-007: Предзаполнение формы из API
  // -------------------------------------------------------------------------

  test.describe('HP-007: Предзаполнение формы из API', { tag: ['@regression'] }, () => {
    test('HP-007-A: поля шага 1 заполнены данными из applicationId=1', async ({
      page,
      creditForm,
    }) => {
      await mockCreditApplicationApi(page, { delay: 100 });
      await mockDictionariesApi(page, { delay: 50 });
      await mockRegionsApi(page, { delay: 50 });
      await mockCitiesApi(page, { delay: 50 });

      await creditForm.goto();

      // Проверяем ключевые поля из MOCK_CREDIT_APPLICATION_1
      await expect(creditForm.input('loanAmount')).toHaveValue(
        String(MOCK_CREDIT_APPLICATION_1.loanAmount)
      );
      await expect(creditForm.input('loanTerm')).toHaveValue(
        String(MOCK_CREDIT_APPLICATION_1.loanTerm)
      );
    });

    test('HP-007-B: поля шага 2 заполнены персональными данными из applicationId=1', async ({
      page,
      creditForm,
    }) => {
      await mockCreditApplicationApi(page, { delay: 100 });
      await mockDictionariesApi(page, { delay: 50 });
      await mockRegionsApi(page, { delay: 50 });
      await mockCitiesApi(page, { delay: 50 });

      await creditForm.goto();

      // Переходим на шаг 2
      await creditForm.goToNextStep();

      const personal = MOCK_CREDIT_APPLICATION_1.personalData!;
      await expect(creditForm.input('personalData-lastName')).toHaveValue(personal.lastName);
      await expect(creditForm.input('personalData-firstName')).toHaveValue(personal.firstName);
    });
  });
});
