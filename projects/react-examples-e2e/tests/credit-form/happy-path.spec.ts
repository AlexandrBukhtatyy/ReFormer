import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';
import {
  CONSUMER_LOAN_DATA,
  MORTGAGE_LOAN_DATA,
  CAR_LOAN_DATA,
  VALID_PERSONAL_DATA,
  VALID_PASSPORT_DATA,
  VALID_INN,
  VALID_SNILS,
  VALID_PHONE,
  VALID_EMAIL,
  VALID_ADDRESS,
  EMPLOYED_DATA,
  ADDITIONAL_INFO,
  VALID_SMS_CODE,
} from '../fixtures/test-data';

test.describe('Happy Path - Базовые сценарии', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  /**
   * TC-HP-001: Успешное заполнение формы потребительского кредита
   * Приоритет: Critical
   */
  test(
    'TC-HP-001: Успешное заполнение формы потребительского кредита',
    {
      tag: ['@critical', '@happy-path'],
    },
    async () => {
      // Шаг 1: Основная информация о кредите
      await creditForm.expectStepHeading(/основная информация о кредите/i);

      await creditForm.selectLoanType('consumer');
      await creditForm.fillLoanAmount(CONSUMER_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(CONSUMER_LOAN_DATA.loanTerm);
      await creditForm.fillLoanPurpose(CONSUMER_LOAN_DATA.loanPurpose);

      await creditForm.goToNextStep();

      // Шаг 2: Персональные данные
      await creditForm.expectStepHeading(/персональные данные/i);

      await creditForm.fillLastName(VALID_PERSONAL_DATA.lastName);
      await creditForm.fillFirstName(VALID_PERSONAL_DATA.firstName);
      await creditForm.fillMiddleName(VALID_PERSONAL_DATA.middleName);
      await creditForm.fillBirthDate(VALID_PERSONAL_DATA.birthDate);
      await creditForm.selectGender(VALID_PERSONAL_DATA.gender);
      await creditForm.fillBirthPlace(VALID_PERSONAL_DATA.birthPlace);

      await creditForm.fillPassportSeries(VALID_PASSPORT_DATA.series);
      await creditForm.fillPassportNumber(VALID_PASSPORT_DATA.number);
      await creditForm.fillPassportIssuedBy(VALID_PASSPORT_DATA.issuedBy);
      await creditForm.fillPassportIssuedDate(VALID_PASSPORT_DATA.issuedDate);
      await creditForm.fillPassportCode(VALID_PASSPORT_DATA.code);

      await creditForm.fillInn(VALID_INN);
      await creditForm.fillSnils(VALID_SNILS);

      await creditForm.goToNextStep();

      // Шаг 3: Контактная информация
      await creditForm.expectStepHeading(/контактная информация/i);

      await creditForm.fillPhone(VALID_PHONE);
      await creditForm.fillEmail(VALID_EMAIL);

      await creditForm.fillRegion(VALID_ADDRESS.region);
      await creditForm.fillCity(VALID_ADDRESS.city);
      await creditForm.fillStreet(VALID_ADDRESS.street);
      await creditForm.fillHouse(VALID_ADDRESS.house);
      await creditForm.fillApartment(VALID_ADDRESS.apartment);
      await creditForm.fillPostalCode(VALID_ADDRESS.postalCode);

      await creditForm.goToNextStep();

      // Шаг 4: Занятость и доход
      await creditForm.expectStepHeading(/занятость|работа/i);

      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName(EMPLOYED_DATA.companyName!);
      await creditForm.fillCompanyInn(EMPLOYED_DATA.companyInn!);
      await creditForm.fillPosition(EMPLOYED_DATA.position!);
      await creditForm.fillMonthlyIncome(EMPLOYED_DATA.monthlyIncome);
      await creditForm.fillWorkExperience(EMPLOYED_DATA.workExperience);
      await creditForm.fillCurrentJobExperience(EMPLOYED_DATA.currentJobExperience);

      await creditForm.goToNextStep();

      // Шаг 5: Дополнительная информация
      await creditForm.expectStepHeading(/дополнительная информация/i);

      await creditForm.selectMaritalStatus(ADDITIONAL_INFO.maritalStatus);
      await creditForm.fillDependents(ADDITIONAL_INFO.dependents);
      await creditForm.selectEducation(ADDITIONAL_INFO.education);

      await creditForm.goToNextStep();

      // Шаг 6: Подтверждение
      await creditForm.expectStepHeading(/подтверждение/i);

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.fillSmsCode(VALID_SMS_CODE);

      await creditForm.submitForm();

      // Проверка успешной отправки
      await creditForm.expectSuccessMessage();
      expect(creditForm.hasNoErrors()).toBe(true);
    }
  );

  /**
   * TC-HP-002: Успешное заполнение формы ипотеки
   * Приоритет: Critical
   */
  test(
    'TC-HP-002: Успешное заполнение формы ипотеки',
    {
      tag: ['@critical', '@happy-path'],
    },
    async () => {
      // Шаг 1: Выбор ипотеки и проверка появления специфичных полей
      await creditForm.selectLoanType('mortgage');

      // Проверяем появление полей ипотеки
      await creditForm.expectFieldVisible('propertyValue');

      await creditForm.fillPropertyValue(MORTGAGE_LOAN_DATA.propertyValue);

      // Проверяем автоматический расчет первоначального взноса (20%)
      await creditForm.expectFieldValue(
        'initialPayment',
        String(MORTGAGE_LOAN_DATA.initialPayment)
      );

      await creditForm.fillLoanAmount(MORTGAGE_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(MORTGAGE_LOAN_DATA.loanTerm);

      await creditForm.goToNextStep();

      // Заполняем остальные шаги (упрощенно)
      await fillRemainingSteps(creditForm);

      // Проверка успешной отправки
      await creditForm.expectSuccessMessage();
      expect(creditForm.hasNoErrors()).toBe(true);
    }
  );

  /**
   * TC-HP-003: Успешное заполнение формы автокредита
   * Приоритет: Critical
   */
  test(
    'TC-HP-003: Успешное заполнение формы автокредита',
    {
      tag: ['@critical', '@happy-path'],
    },
    async () => {
      // Шаг 1: Выбор автокредита и проверка появления специфичных полей
      await creditForm.selectLoanType('car');

      // Проверяем появление полей автокредита
      await creditForm.expectFieldVisible('carBrand');
      await creditForm.expectFieldVisible('carModel');
      await creditForm.expectFieldVisible('carYear');
      await creditForm.expectFieldVisible('carPrice');

      await creditForm.fillCarBrand(CAR_LOAN_DATA.carBrand);
      // Ждём загрузки моделей
      await creditForm.page.waitForTimeout(500);
      await creditForm.selectCarModel(CAR_LOAN_DATA.carModel);
      await creditForm.fillCarYear(CAR_LOAN_DATA.carYear);
      await creditForm.fillCarPrice(CAR_LOAN_DATA.carPrice);

      await creditForm.fillLoanAmount(CAR_LOAN_DATA.loanAmount);
      await creditForm.fillLoanTerm(CAR_LOAN_DATA.loanTerm);

      await creditForm.goToNextStep();

      // Заполняем остальные шаги
      await fillRemainingSteps(creditForm);

      // Проверка успешной отправки
      await creditForm.expectSuccessMessage();
      expect(creditForm.hasNoErrors()).toBe(true);
    }
  );

  /**
   * TC-HP-004: Загрузка и редактирование существующей заявки
   * Приоритет: Critical
   */
  test(
    'TC-HP-004: Загрузка и редактирование существующей заявки',
    {
      tag: ['@critical', '@happy-path'],
    },
    async () => {
      // Форма уже загружена с данными (applicationId='1' в компоненте)
      // Проверяем, что поля предзаполнены

      // Проверка что данные загружены
      const currentValue = await creditForm.input('loanAmount').inputValue();
      expect(currentValue).not.toBe('');

      // Изменяем сумму кредита
      const newAmount = 600000;
      await creditForm.fillLoanAmount(newAmount);

      // Проходим до конца формы
      for (let step = 1; step < 6; step++) {
        await creditForm.goToNextStep();
      }

      // На шаге 6 принимаем согласия и отправляем
      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.fillSmsCode(VALID_SMS_CODE);

      await creditForm.submitForm();

      // Проверка успешной отправки
      await creditForm.expectSuccessMessage();
    }
  );

  /**
   * TC-HP-005: Режим просмотра заявки
   * Приоритет: High
   */
  test(
    'TC-HP-005: Режим просмотра заявки',
    {
      tag: ['@high', '@happy-path'],
    },
    async () => {
      // Примечание: для этого теста нужно открыть форму в режиме view
      // Сейчас форма открывается в режиме edit по умолчанию
      // Тест будет обновлен когда будет доступна возможность переключения режимов

      // Временно проверяем базовую функциональность
      await creditForm.expectStepHeading(/основная информация о кредите/i);

      // Проверяем что навигация между шагами работает
      await creditForm.goToNextStep();
      await creditForm.expectStepHeading(/персональные данные/i);

      await creditForm.goToPreviousStep();
      await creditForm.expectStepHeading(/основная информация о кредите/i);
    }
  );
});

/**
 * Вспомогательная функция для заполнения оставшихся шагов
 */
async function fillRemainingSteps(creditForm: CreditFormPage) {
  // Шаг 2: Персональные данные
  await creditForm.fillLastName(VALID_PERSONAL_DATA.lastName);
  await creditForm.fillFirstName(VALID_PERSONAL_DATA.firstName);
  await creditForm.fillMiddleName(VALID_PERSONAL_DATA.middleName);
  await creditForm.fillBirthDate(VALID_PERSONAL_DATA.birthDate);
  await creditForm.selectGender(VALID_PERSONAL_DATA.gender);
  await creditForm.fillBirthPlace(VALID_PERSONAL_DATA.birthPlace);
  await creditForm.fillPassportSeries(VALID_PASSPORT_DATA.series);
  await creditForm.fillPassportNumber(VALID_PASSPORT_DATA.number);
  await creditForm.fillPassportIssuedBy(VALID_PASSPORT_DATA.issuedBy);
  await creditForm.fillPassportIssuedDate(VALID_PASSPORT_DATA.issuedDate);
  await creditForm.fillPassportCode(VALID_PASSPORT_DATA.code);
  await creditForm.fillInn(VALID_INN);
  await creditForm.fillSnils(VALID_SNILS);
  await creditForm.goToNextStep();

  // Шаг 3: Контакты
  await creditForm.fillPhone(VALID_PHONE);
  await creditForm.fillEmail(VALID_EMAIL);
  await creditForm.fillRegion(VALID_ADDRESS.region);
  await creditForm.fillCity(VALID_ADDRESS.city);
  await creditForm.fillStreet(VALID_ADDRESS.street);
  await creditForm.fillHouse(VALID_ADDRESS.house);
  await creditForm.fillApartment(VALID_ADDRESS.apartment);
  await creditForm.fillPostalCode(VALID_ADDRESS.postalCode);
  await creditForm.goToNextStep();

  // Шаг 4: Занятость
  await creditForm.selectEmploymentStatus('employed');
  await creditForm.fillCompanyName(EMPLOYED_DATA.companyName!);
  await creditForm.fillCompanyInn(EMPLOYED_DATA.companyInn!);
  await creditForm.fillPosition(EMPLOYED_DATA.position!);
  await creditForm.fillMonthlyIncome(EMPLOYED_DATA.monthlyIncome);
  await creditForm.fillWorkExperience(EMPLOYED_DATA.workExperience);
  await creditForm.fillCurrentJobExperience(EMPLOYED_DATA.currentJobExperience);
  await creditForm.goToNextStep();

  // Шаг 5: Дополнительная информация
  await creditForm.selectMaritalStatus(ADDITIONAL_INFO.maritalStatus);
  await creditForm.fillDependents(ADDITIONAL_INFO.dependents);
  await creditForm.selectEducation(ADDITIONAL_INFO.education);
  await creditForm.goToNextStep();

  // Шаг 6: Подтверждение
  await creditForm.acceptPersonalDataAgreement();
  await creditForm.acceptCreditHistoryAgreement();
  await creditForm.acceptTermsAgreement();
  await creditForm.fillSmsCode(VALID_SMS_CODE);
  await creditForm.submitForm();
}
