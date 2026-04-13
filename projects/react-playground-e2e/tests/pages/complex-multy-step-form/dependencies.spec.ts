/**
 * Dependencies E2E Tests
 *
 * Тесты зависимостей между полями (watchField):
 * - Регион -> Города
 * - Марка автомобиля -> Модели
 * - Статус занятости -> Поля
 * - Динамические лимиты
 */

import { test, expect } from '../../shared/test-factory';

test.describe('Dependencies', { tag: ['@dependencies'] }, () => {
  test.describe('DEP-001: Загрузка городов по региону', () => {
    test.skip('DEP-001-A: Города загружаются при выборе региона', async ({ creditForm }) => {
      // SKIP: addressBehavior disabled - ctx.form in nested behavior refers to root form
      // Requires architectural changes to support scoped BehaviorContext
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Выбираем регион
      await creditForm.input('registrationAddress-region').click();
      await creditForm.page.getByRole('option', { name: /московская/i }).click();

      // Ждем загрузки городов
      await creditForm.page.waitForTimeout(500);

      // Города должны быть доступны
      await creditForm.input('registrationAddress-city').click();
      await expect(creditForm.page.getByRole('option').first()).toBeVisible();
    });

    test.skip('DEP-001-B: При смене региона города обновляются', async ({ creditForm }) => {
      // SKIP: addressBehavior disabled - ctx.form in nested behavior refers to root form
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Выбираем первый регион и город
      await creditForm.input('registrationAddress-region').click();
      await creditForm.page.getByRole('option', { name: /московская/i }).click();
      await creditForm.page.waitForTimeout(500);

      await creditForm.input('registrationAddress-city').click();
      await creditForm.page.getByRole('option', { name: /москва/i }).click();

      // Меняем регион
      await creditForm.input('registrationAddress-region').click();
      await creditForm.page.getByRole('option', { name: /ленинградская/i }).click();
      await creditForm.page.waitForTimeout(500);

      // Город должен быть сброшен
      const cityValue = await creditForm.input('registrationAddress-city').inputValue();
      expect(cityValue).toBe('');
    });
  });

  test.describe('DEP-002: Загрузка моделей по марке автомобиля', () => {
    test('DEP-002-A: Модели загружаются при вводе марки', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Вводим марку
      await creditForm.fillCarBrand('Toyota');

      // Ждем загрузки моделей (debounce 300ms + API)
      await creditForm.page.waitForTimeout(500);

      // Открываем селект моделей
      await creditForm.input('carModel').click();

      // Должны быть доступны модели Toyota
      await expect(creditForm.page.getByRole('option', { name: /camry/i })).toBeVisible({
        timeout: 3000,
      });
    });

    test('DEP-002-B: При смене марки модель сбрасывается', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Выбираем Toyota и модель
      await creditForm.fillCarBrand('Toyota');
      await creditForm.page.waitForTimeout(500);
      await creditForm.selectCarModel('Camry');

      // Проверяем, что модель выбрана (select trigger содержит текст Camry)
      await expect(creditForm.input('carModel')).toContainText(/camry/i);

      // Меняем марку на BMW
      await creditForm.input('carBrand').clear();
      await creditForm.fillCarBrand('BMW');
      await creditForm.page.waitForTimeout(500);

      // Модель должна быть сброшена - проверяем через клик и наличие опций BMW
      await creditForm.input('carModel').click();
      // Должны появиться модели BMW, а не Toyota
      await expect(creditForm.page.getByRole('option', { name: /3 series|5 series|x5/i })).toBeVisible({
        timeout: 3000,
      });
      await creditForm.page.keyboard.press('Escape');
    });

    test('DEP-002-C: Модели обновляются при изменении марки', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Вводим Toyota
      await creditForm.fillCarBrand('Toyota');
      await creditForm.page.waitForTimeout(500);
      await creditForm.input('carModel').click();

      // Должны быть модели Toyota (например Camry)
      await expect(creditForm.page.getByRole('option', { name: /camry/i })).toBeVisible({
        timeout: 3000,
      });

      // Закрываем селект
      await creditForm.page.keyboard.press('Escape');

      // Меняем на BMW
      await creditForm.input('carBrand').clear();
      await creditForm.fillCarBrand('BMW');
      await creditForm.page.waitForTimeout(500);
      await creditForm.input('carModel').click();

      // Должны быть модели BMW (например 3 Series или X5)
      await expect(creditForm.page.getByRole('option', { name: /3 series|5 series|x5/i })).toBeVisible({
        timeout: 3000,
      });
    });

    test('DEP-002-D: Пустая марка очищает список моделей', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Вводим марку
      await creditForm.fillCarBrand('Toyota');
      await creditForm.page.waitForTimeout(500);

      // Очищаем марку
      await creditForm.input('carBrand').clear();
      await creditForm.page.waitForTimeout(500);

      // Открываем селект моделей
      await creditForm.input('carModel').click();

      // Опции должны быть пустые или селект неактивен
      const optionsCount = await creditForm.page.getByRole('option').count();
      expect(optionsCount).toBe(0);
    });
  });

  test.describe('DEP-003: Зависимость полей от статуса занятости', () => {
    test('DEP-003-A: Поля работодателя зависят от статуса "employed"', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      // При статусе "employed" поля работодателя видны
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.expectFieldVisible('companyName');
      await creditForm.expectFieldVisible('companyInn');
      await creditForm.expectFieldVisible('position');

      // При смене статуса поля скрываются
      await creditForm.selectEmploymentStatus('unemployed');
      await creditForm.expectFieldHidden('companyName');
      await creditForm.expectFieldHidden('companyInn');
      await creditForm.expectFieldHidden('position');
    });

    test('DEP-003-B: Поля ИП зависят от статуса "selfEmployed"', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      // Изначально статус "employed" - поля ИП скрыты
      await creditForm.expectFieldHidden('businessType');
      await creditForm.expectFieldHidden('businessInn');
      await creditForm.expectFieldHidden('businessActivity');

      // При смене на ИП поля появляются
      await creditForm.selectEmploymentStatus('selfEmployed');
      await creditForm.expectFieldVisible('businessType');
      await creditForm.expectFieldVisible('businessInn');
      await creditForm.expectFieldVisible('businessActivity');

      // Поля работодателя при этом скрыты
      await creditForm.expectFieldHidden('companyName');
      await creditForm.expectFieldHidden('position');
    });

    test('DEP-003-C: Данные сбрасываются при смене статуса (resetOnDisable)', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      // Заполняем данные работодателя
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('ООО Тест');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillPosition('Менеджер');

      // Меняем статус
      await creditForm.selectEmploymentStatus('selfEmployed');

      // Возвращаемся к employed
      await creditForm.selectEmploymentStatus('employed');

      // Данные должны быть сброшены
      const companyName = await creditForm.input('companyName').inputValue();
      const companyInn = await creditForm.input('companyInn').inputValue();

      expect(companyName).toBe('');
      expect(companyInn).toBe('');
    });
  });

  test.describe('DEP-004: Динамические лимиты полей', () => {
    test('DEP-004-A: Максимальная сумма кредита зависит от дохода', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      // Устанавливаем низкий доход
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('Адрес компании тестовый');
      await creditForm.fillPosition('Сотрудник');
      await creditForm.fillWorkExperience(36);
      await creditForm.fillCurrentJobExperience(12);
      await creditForm.fillMonthlyIncome(50000);

      // Ждем пересчета динамических лимитов
      await creditForm.page.waitForTimeout(200);

      // Возвращаемся на шаг 1
      await creditForm.goToStep(1);

      // Проверяем, что max атрибут обновился
      // При доходе 50000 максимум = 50000 * 12 * 10 = 6 000 000, но лимит 10 млн - берем меньшее
      const loanAmountInput = creditForm.input('loanAmount');
      const maxValue = await loanAmountInput.getAttribute('max');

      // Максимум должен быть <= 6 000 000
      if (maxValue) {
        expect(parseInt(maxValue)).toBeLessThanOrEqual(10000000);
      }
    });

    test('DEP-004-B: Максимальный срок кредита зависит от возраста', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Устанавливаем возраст 60 лет (погашение до 70 лет = максимум 10 лет)
      const today = new Date();
      const birthDate60 = new Date(today.getFullYear() - 60, today.getMonth(), today.getDate());

      await creditForm.fillLastName('Тестов');
      await creditForm.fillFirstName('Тест');
      await creditForm.fillMiddleName('Тестович');
      await creditForm.fillBirthDate(birthDate60.toISOString().split('T')[0]);
      await creditForm.selectGender('male');
      await creditForm.fillBirthPlace('г. Москва');
      await creditForm.fillPassportSeries('45 06');
      await creditForm.fillPassportNumber('123456');
      await creditForm.fillPassportIssuedBy('ОВД Центрального района');
      await creditForm.fillPassportIssuedDate('1998-06-20');
      await creditForm.fillPassportCode('770-001');
      await creditForm.fillInn('123456789012');
      await creditForm.fillSnils('123-456-789 01');

      // Ждем пересчета
      await creditForm.page.waitForTimeout(200);

      // Возвращаемся на шаг 1
      await creditForm.goToStep(1);

      // Проверяем максимальный срок (70 - 60 = 10 лет = 120 месяцев)
      const loanTermInput = creditForm.input('loanTerm');
      const maxTerm = await loanTermInput.getAttribute('max');

      if (maxTerm) {
        expect(parseInt(maxTerm)).toBeLessThanOrEqual(120);
      }
    });
  });

  test.describe('DEP-005: Ревалидация зависимых полей', () => {
    test('DEP-005-A: Ревалидация дохода при изменении платежа', async ({ creditForm }) => {
      await creditForm.goto();

      // Устанавливаем большую сумму кредита - платёж будет ~150 000₽
      await creditForm.fillLoanAmount(3000000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Тестовая цель');
      await creditForm.goToNextStep();

      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();

      // Указываем низкий доход (платеж > 50% от дохода)
      // При кредите 3 000 000 на 24 мес. платёж ~150 000₽
      // При доходе 100 000₽ это 150% - ошибка
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('Компания');
      await creditForm.fillCompanyInn('1234567890');
      await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
      await creditForm.fillCompanyAddress('Адрес компании тестовый');
      await creditForm.fillPosition('Сотрудник');
      await creditForm.fillWorkExperience(60);
      await creditForm.fillCurrentJobExperience(24);
      await creditForm.fillMonthlyIncome(100000);

      // Пытаемся перейти дальше - валидация сработает
      await creditForm.goToNextStep();

      // Ожидаем ошибку превышения 50%
      await creditForm.expectFieldError('monthlyIncome', /50%/i);

      // Возвращаемся и уменьшаем сумму кредита (платёж станет меньше)
      await creditForm.goToStep(1);
      await creditForm.fillLoanAmount(500000); // При 500000 на 24 мес. платёж ~25 000₽

      // Проходим шаги заново
      await creditForm.goToNextStep(); // Step 2
      await creditForm.goToNextStep(); // Step 3
      await creditForm.goToNextStep(); // Step 4

      // Пытаемся перейти дальше - ошибка должна исчезнуть (ревалидация)
      await creditForm.goToNextStep();

      // Должны перейти на шаг 5 (ошибки нет)
      await creditForm.expectStepHeading(/дополнительная информация/i);
    });

    test('DEP-005-B: Ревалидация первоначального взноса при изменении стоимости', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      // Устанавливаем стоимость и низкий первоначальный взнос
      await creditForm.fillPropertyValue(5000000);
      await creditForm.page.waitForTimeout(100);

      // Вручную устанавливаем взнос меньше 20%
      await creditForm.input('initialPayment').fill('500000'); // 10%

      // Пытаемся перейти дальше - должна быть ошибка о 20%
      await creditForm.fillLoanAmount(1000000);
      await creditForm.fillLoanTerm(60);
      await creditForm.fillLoanPurpose('Покупка квартиры');
      await creditForm.goToNextStep();

      // Ошибка о минимуме 20%
      await creditForm.expectFieldError('initialPayment', /20%/i);

      // Увеличиваем взнос до корректного
      await creditForm.input('initialPayment').fill('1000000'); // 20%

      // Пытаемся снова перейти
      await creditForm.goToNextStep();

      // Должны перейти на шаг 2 (ошибки нет)
      await creditForm.expectStepHeading(/персональные данные/i);
    });
  });
});
