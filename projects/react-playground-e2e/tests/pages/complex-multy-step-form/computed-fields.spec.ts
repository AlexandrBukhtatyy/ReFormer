/**
 * Computed Fields E2E Tests
 *
 * Тесты вычисляемых полей формы (computeFrom):
 * - Ежемесячный платеж
 * - Процентная ставка
 * - Возраст
 * - Соотношение платеж/доход
 * - Полное имя
 * - Общий доход
 * - Доход созаемщиков
 */

import { test, expect } from '../../shared/test-factory';

test.describe('Computed Fields', { tag: ['@computed'] }, () => {
  test.describe('COMP-001: Ежемесячный платеж', () => {
    test('COMP-001-A: Автоматический расчет ежемесячного платежа', async ({ creditForm }) => {
      await creditForm.goto();

      // Заполняем данные для расчета
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);

      // Ждем пересчета
      await creditForm.page.waitForTimeout(200);

      // Переходим на шаг 6 для просмотра вычисляемых полей
      await creditForm.fillLoanPurpose('Тестовая цель кредита');
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      // Проверяем, что ежемесячный платеж рассчитан и отображается
      const monthlyPaymentElement = creditForm.computed('monthlyPayment');
      await expect(monthlyPaymentElement).toBeVisible();

      const payment = await creditForm.getComputedValue('monthlyPayment');

      // Платеж должен быть больше 0
      expect(payment).toBeGreaterThan(0);

      // Примерный расчет: для 500000 на 24 месяца при ~15.5% ставке
      // Платеж должен быть около 24000-26000
      expect(payment).toBeGreaterThan(20000);
      expect(payment).toBeLessThan(30000);
    });

    test('COMP-001-B: Платеж пересчитывается при изменении суммы', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      // Запоминаем текущий платеж
      const initialPayment = await creditForm.getComputedValue('monthlyPayment');

      // Возвращаемся на шаг 1 и увеличиваем сумму
      await creditForm.goToStep(1);
      await creditForm.fillLoanAmount(1000000);

      // Возвращаемся на шаг 6
      await creditForm.goToNextStep();
      await creditForm.goToNextStep();
      await creditForm.goToNextStep();
      await creditForm.goToNextStep();
      await creditForm.goToNextStep();

      // Платеж должен увеличиться
      const newPayment = await creditForm.getComputedValue('monthlyPayment');
      expect(newPayment).toBeGreaterThan(initialPayment);
    });

    test('COMP-001-C: Платеж пересчитывается при изменении срока', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      const initialPayment = await creditForm.getComputedValue('monthlyPayment');

      // Увеличиваем срок - платеж должен уменьшиться
      await creditForm.goToStep(1);
      await creditForm.fillLoanTerm(60); // 5 лет вместо 2

      await creditForm.goToNextStep();
      await creditForm.goToNextStep();
      await creditForm.goToNextStep();
      await creditForm.goToNextStep();
      await creditForm.goToNextStep();

      const newPayment = await creditForm.getComputedValue('monthlyPayment');
      expect(newPayment).toBeLessThan(initialPayment);
    });
  });

  test.describe('COMP-002: Процентная ставка', () => {
    test('COMP-002-A: Ставка для потребительского кредита ~15.5%', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      const rate = await creditForm.getComputedValue('interestRate');

      // Базовая ставка для потребительского кредита 15.5%
      expect(rate).toBeCloseTo(15.5, 0);
    });

    test('COMP-002-B: Ставка для ипотеки ниже (~8.5%)', async ({ creditForm }) => {
      await creditForm.goto();

      await creditForm.selectLoanType('mortgage');
      await creditForm.fillPropertyValue(5000000);
      await creditForm.page.waitForTimeout(100);
      await creditForm.fillLoanAmount(4000000);
      await creditForm.fillLoanTerm(240);
      await creditForm.fillLoanPurpose('Покупка квартиры');
      await creditForm.goToNextStep();

      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      // Высокий доход для ипотеки
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Крупная компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
      await creditForm.fillPosition('Директор');
      await creditForm.fillWorkExperience(120);
      await creditForm.fillCurrentJobExperience(60);
      await creditForm.fillMonthlyIncome(500000);
      await creditForm.goToNextStep();

      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      const rate = await creditForm.getComputedValue('interestRate');

      // Ипотечная ставка ~8.5%
      expect(rate).toBeCloseTo(8.5, 0);
    });

    test('COMP-002-C: Ставка для автокредита ~12%', async ({ creditForm }) => {
      await creditForm.goto();

      await creditForm.selectLoanType('car');
      await creditForm.fillCarBrand('Toyota');
      await creditForm.page.waitForTimeout(500);
      await creditForm.selectCarModel('Camry');
      await creditForm.fillCarYear(2023);
      await creditForm.fillCarPrice(3000000);
      await creditForm.fillLoanAmount(2500000);
      await creditForm.fillLoanTerm(60);
      await creditForm.fillLoanPurpose('Покупка автомобиля');
      await creditForm.goToNextStep();

      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      const rate = await creditForm.getComputedValue('interestRate');

      expect(rate).toBeCloseTo(12, 0);
    });

    test('COMP-002-D: Скидка за наличие имущества (-0.5%)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      // Запоминаем ставку без имущества
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();
      const rateWithoutProperty = await creditForm.getComputedValue('interestRate');

      // Возвращаемся и добавляем имущество
      await creditForm.goToPreviousStep();
      await creditForm.toggleHasProperty(true);
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();

      // Заполняем информацию об имуществе
      await creditForm.input('property-type').first().click();
      await creditForm.page.getByRole('option', { name: /квартира/i }).click();
      await creditForm.input('property-estimatedValue').first().fill('5000000');

      await creditForm.goToNextStep();

      const rateWithProperty = await creditForm.getComputedValue('interestRate');

      // Ставка должна уменьшиться на 0.5%
      expect(rateWithProperty).toBeLessThan(rateWithoutProperty);
      expect(rateWithoutProperty - rateWithProperty).toBeCloseTo(0.5, 1);
    });
  });

  test.describe('COMP-003: Возраст', () => {
    test('COMP-003-A: Автоматический расчет возраста из даты рождения', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Устанавливаем дату рождения 30 лет назад
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
      const formattedDate = birthDate.toISOString().split('T')[0];

      await creditForm.fillLastName('Иванов');
      await creditForm.fillFirstName('Иван');
      await creditForm.fillMiddleName('Иванович');
      await creditForm.fillBirthDate(formattedDate);
      await creditForm.selectGender('male');
      await creditForm.fillBirthPlace('г. Москва');

      // Заполняем паспортные данные
      await creditForm.fillPassportSeries('45 06');
      await creditForm.fillPassportNumber('123456');
      await creditForm.fillPassportIssuedBy('ОВД Центрального района');
      await creditForm.fillPassportIssuedDate('2010-06-20');
      await creditForm.fillPassportCode('770-001');
      await creditForm.fillInn('123456789012');
      await creditForm.fillSnils('123-456-789 01');

      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      // Проверяем вычисленный возраст
      const ageElement = creditForm.computed('age');
      const ageText = await ageElement.textContent();
      expect(parseInt(ageText || '0')).toBe(30);
    });

    test('COMP-003-B: Возраст пересчитывается при изменении даты рождения', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Сначала 25 лет
      const today = new Date();
      const birthDate25 = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());

      await creditForm.fillLastName('Иванов');
      await creditForm.fillFirstName('Иван');
      await creditForm.fillMiddleName('Иванович');
      await creditForm.fillBirthDate(birthDate25.toISOString().split('T')[0]);

      // Меняем на 40 лет
      const birthDate40 = new Date(today.getFullYear() - 40, today.getMonth(), today.getDate());
      await creditForm.fillBirthDate(birthDate40.toISOString().split('T')[0]);

      await creditForm.selectGender('male');
      await creditForm.fillBirthPlace('г. Москва');
      await creditForm.fillPassportSeries('45 06');
      await creditForm.fillPassportNumber('123456');
      await creditForm.fillPassportIssuedBy('ОВД Центрального района');
      await creditForm.fillPassportIssuedDate('2000-06-20');
      await creditForm.fillPassportCode('770-001');
      await creditForm.fillInn('123456789012');
      await creditForm.fillSnils('123-456-789 01');

      // Переходим на финальный шаг
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      const ageText = await creditForm.computed('age').textContent();
      expect(parseInt(ageText || '0')).toBe(40);
    });
  });

  test.describe('COMP-004: Соотношение платеж/доход', () => {
    test('COMP-004-A: Расчет соотношения платежа к доходу', async ({ creditForm }) => {
      await creditForm.goto();

      // Кредит с известным платежом
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Тестовая цель');
      await creditForm.goToNextStep();

      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      // Устанавливаем известный доход
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Тест Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
      await creditForm.fillPosition('Менеджер');
      await creditForm.fillWorkExperience(60);
      await creditForm.fillCurrentJobExperience(24);
      await creditForm.fillMonthlyIncome(100000);
      await creditForm.goToNextStep();

      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      // Проверяем соотношение
      const ratioElement = creditForm.computed('paymentToIncomeRatio');
      const ratioText = await ratioElement.textContent();
      const ratio = parseFloat(ratioText || '0');

      // Платеж ~25000, доход 100000 = ~25%
      expect(ratio).toBeGreaterThan(20);
      expect(ratio).toBeLessThan(30);
    });

    test('COMP-004-B: Учет дополнительного дохода в расчете', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      // Устанавливаем основной доход
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Тест Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
      await creditForm.fillPosition('Менеджер');
      await creditForm.fillWorkExperience(60);
      await creditForm.fillCurrentJobExperience(24);
      await creditForm.fillMonthlyIncome(100000);
      await creditForm.goToNextStep();
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      // Запоминаем соотношение без дополнительного дохода
      const ratioWithoutAdditional = parseFloat(
        (await creditForm.computed('paymentToIncomeRatio').textContent()) || '0'
      );

      // Добавляем дополнительный доход
      await creditForm.goToStep(4);
      await creditForm.fillAdditionalIncome(50000);
      await creditForm.input('additionalIncomeSource').fill('Аренда недвижимости');

      await creditForm.goToNextStep();
      await creditForm.goToNextStep();

      // Соотношение должно уменьшиться
      const ratioWithAdditional = parseFloat(
        (await creditForm.computed('paymentToIncomeRatio').textContent()) || '0'
      );

      expect(ratioWithAdditional).toBeLessThan(ratioWithoutAdditional);
    });
  });

  test.describe('COMP-005: Полное имя', () => {
    test('COMP-005-A: Автоматическая конкатенация ФИО', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      await creditForm.fillLastName('Петров');
      await creditForm.fillFirstName('Петр');
      await creditForm.fillMiddleName('Петрович');

      // Ждем вычисления
      await creditForm.page.waitForTimeout(100);

      await creditForm.selectGender('male');
      await creditForm.fillBirthDate('1990-01-01');
      await creditForm.fillBirthPlace('г. Москва');
      await creditForm.fillPassportSeries('45 06');
      await creditForm.fillPassportNumber('123456');
      await creditForm.fillPassportIssuedBy('ОВД Центрального района');
      await creditForm.fillPassportIssuedDate('2010-06-20');
      await creditForm.fillPassportCode('770-001');
      await creditForm.fillInn('123456789012');
      await creditForm.fillSnils('123-456-789 01');
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      // Проверяем полное имя
      const fullNameElement = creditForm.computed('fullName');
      const fullName = await fullNameElement.textContent();

      expect(fullName).toContain('Петров');
      expect(fullName).toContain('Петр');
      expect(fullName).toContain('Петрович');
    });
  });

  test.describe('COMP-006: Общий доход', () => {
    test('COMP-006-A: Сумма основного и дополнительного дохода', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Тест Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
      await creditForm.fillPosition('Менеджер');
      await creditForm.fillWorkExperience(60);
      await creditForm.fillCurrentJobExperience(24);
      await creditForm.fillMonthlyIncome(100000);
      await creditForm.fillAdditionalIncome(30000);
      await creditForm.input('additionalIncomeSource').fill('Аренда');

      await creditForm.goToNextStep();
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();

      // Проверяем общий доход (отображается с форматированием)
      const totalIncomeElement = creditForm.computed('totalIncome');
      const totalIncomeText = await totalIncomeElement.textContent();
      // Убираем пробелы форматирования (130 000 -> 130000)
      const totalIncome = parseInt((totalIncomeText || '0').replace(/\s/g, ''));

      expect(totalIncome).toBe(130000); // 100000 + 30000
    });
  });

  test.describe('COMP-007: Доход созаемщиков', () => {
    test('COMP-007-A: Сумма доходов всех созаемщиков', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      // Добавляем созаемщиков
      await creditForm.selectMaritalStatus('married');
      await creditForm.fillDependents(0);
      await creditForm.selectEducation('higher');
      await creditForm.toggleHasProperty(false);
      await creditForm.toggleHasLoans(false);
      await creditForm.toggleAddCoBorrower(true);

      // Добавляем первого созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.input('coBorrower-lastName').first().fill('Иванова');
      await creditForm.input('coBorrower-firstName').first().fill('Анна');
      await creditForm.input('coBorrower-middleName').first().fill('Ивановна');
      await creditForm.input('coBorrower-birthDate').first().fill('1992-03-15');
      await creditForm.input('coBorrower-phone').first().fill('+7 (999) 222-33-44');
      await creditForm.input('coBorrower-email').first().fill('anna@example.com');
      await creditForm.input('coBorrower-monthlyIncome').first().fill('80000');

      // Добавляем второго созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      const secondCoBorrower = creditForm.page.locator('[class*="coborrower"]').last();
      await creditForm.input('coBorrower-lastName').last().fill('Петров');
      await creditForm.input('coBorrower-firstName').last().fill('Алексей');
      await creditForm.input('coBorrower-middleName').last().fill('Алексеевич');
      await creditForm.input('coBorrower-birthDate').last().fill('1985-07-20');
      await creditForm.input('coBorrower-phone').last().fill('+7 (999) 333-44-55');
      await creditForm.input('coBorrower-email').last().fill('alexey@example.com');
      await creditForm.input('coBorrower-monthlyIncome').last().fill('120000');

      await creditForm.goToNextStep();

      // Проверяем общий доход созаемщиков (отображается с форматированием)
      const coBorrowersIncomeElement = creditForm.computed('coBorrowersIncome');
      const coBorrowersIncomeText = await coBorrowersIncomeElement.textContent();
      // Убираем пробелы форматирования (200 000 -> 200000)
      const coBorrowersIncome = parseInt((coBorrowersIncomeText || '0').replace(/\s/g, ''));

      expect(coBorrowersIncome).toBe(200000); // 80000 + 120000
    });
  });
});
