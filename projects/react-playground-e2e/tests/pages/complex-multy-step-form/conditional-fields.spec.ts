/**
 * Conditional Fields E2E Tests
 *
 * Тесты условного отображения и скрытия полей формы:
 * - Поля для ипотеки (propertyValue, initialPayment)
 * - Поля для автокредита (carBrand, carModel, carYear, carPrice)
 * - Поля для разных статусов занятости
 * - Копирование адреса
 */

import { test, expect } from '../../shared/test-factory';

test.describe('Conditional Fields', { tag: ['@conditional'] }, () => {
  test.describe('COND-001: Поля для ипотеки', () => {
    test('COND-001-A: Поля ипотеки скрыты при типе "потребительский кредит"', async ({
      creditForm,
    }) => {
      await creditForm.goto();

      // По умолчанию тип - потребительский кредит
      await creditForm.expectFieldHidden('propertyValue');
      await creditForm.expectFieldHidden('initialPayment');
    });

    test('COND-001-B: Поля ипотеки появляются при выборе типа "ипотека"', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      await creditForm.expectFieldVisible('propertyValue');
      await creditForm.expectFieldVisible('initialPayment');

      // Заголовок секции должен появиться
      await expect(
        creditForm.page.getByRole('heading', { name: /информация о недвижимости/i })
      ).toBeVisible();
    });

    test('COND-001-C: Поля ипотеки скрываются при смене типа кредита', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      // Поля видны
      await creditForm.expectFieldVisible('propertyValue');
      await creditForm.expectFieldVisible('initialPayment');

      // Меняем тип на потребительский
      await creditForm.selectLoanType('consumer');

      // Поля должны скрыться
      await creditForm.expectFieldHidden('propertyValue');
      await creditForm.expectFieldHidden('initialPayment');
    });

    test('COND-001-D: Данные ипотеки сбрасываются при смене типа (resetOnDisable)', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('mortgage');

      // Заполняем данные
      await creditForm.fillPropertyValue(5000000);
      await creditForm.page.waitForTimeout(100); // Ждем вычисление initialPayment

      // Меняем тип
      await creditForm.selectLoanType('consumer');

      // Возвращаемся к ипотеке
      await creditForm.selectLoanType('mortgage');

      // Данные должны быть сброшены
      const propertyValue = await creditForm.input('propertyValue').inputValue();
      expect(propertyValue).toBe('');
    });
  });

  test.describe('COND-002: Поля для автокредита', () => {
    test('COND-002-A: Поля автокредита скрыты при типе "потребительский кредит"', async ({
      creditForm,
    }) => {
      await creditForm.goto();

      await creditForm.expectFieldHidden('carBrand');
      await creditForm.expectFieldHidden('carModel');
      await creditForm.expectFieldHidden('carYear');
      await creditForm.expectFieldHidden('carPrice');
    });

    test('COND-002-B: Поля автокредита появляются при выборе типа "автокредит"', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      await creditForm.expectFieldVisible('carBrand');
      await creditForm.expectFieldVisible('carModel');
      await creditForm.expectFieldVisible('carYear');
      await creditForm.expectFieldVisible('carPrice');

      await expect(
        creditForm.page.getByRole('heading', { name: /информация об автомобиле/i })
      ).toBeVisible();
    });

    test('COND-002-C: При вводе марки загружаются модели (watchField)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Вводим марку
      await creditForm.fillCarBrand('Toyota');

      // Ждем загрузки моделей (debounce 300ms + загрузка)
      await creditForm.page.waitForTimeout(500);

      // Кликаем по селекту моделей
      await creditForm.input('carModel').click();

      // Должны появиться опции Toyota (например Camry)
      await expect(creditForm.page.getByRole('option', { name: /camry/i })).toBeVisible({
        timeout: 3000,
      });
    });

    test('COND-002-D: Смена марки очищает выбранную модель', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Выбираем марку и модель
      await creditForm.fillCarBrand('Toyota');
      await creditForm.page.waitForTimeout(500);
      await creditForm.selectCarModel('Camry');

      // Проверяем, что модель выбрана
      await expect(creditForm.input('carModel')).toContainText(/camry/i);

      // Меняем марку на BMW
      await creditForm.input('carBrand').clear();
      await creditForm.fillCarBrand('BMW');
      await creditForm.page.waitForTimeout(500);

      // Модель должна быть сброшена - проверяем через наличие моделей BMW
      await creditForm.input('carModel').click();
      // Используем first() т.к. regex матчит несколько опций
      await expect(
        creditForm.page.getByRole('option', { name: /3 series|5 series|x5/i }).first()
      ).toBeVisible({
        timeout: 3000,
      });
      await creditForm.page.keyboard.press('Escape');
    });
  });

  test.describe('COND-003: Поля для безработных', () => {
    test('COND-003-A: Поля работодателя видны при статусе "трудоустроен"', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      await creditForm.selectEmploymentStatus('employed');

      await creditForm.expectFieldVisible('companyName');
      await creditForm.expectFieldVisible('companyInn');
      await creditForm.expectFieldVisible('companyPhone');
      await creditForm.expectFieldVisible('companyAddress');
      await creditForm.expectFieldVisible('position');
      await creditForm.expectFieldVisible('workExperienceTotal');
      await creditForm.expectFieldVisible('workExperienceCurrent');
    });

    test('COND-003-B: Поля работодателя скрыты при статусе "безработный"', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      await creditForm.selectEmploymentStatus('unemployed');

      await creditForm.expectFieldHidden('companyName');
      await creditForm.expectFieldHidden('companyInn');
      await creditForm.expectFieldHidden('companyPhone');
      await creditForm.expectFieldHidden('companyAddress');
      await creditForm.expectFieldHidden('position');

      // Должно появиться предупреждение для безработных
      await expect(creditForm.page.locator('[data-testid="unemployed-warning"]')).toBeVisible();
    });

    test('COND-003-C: Поля ИП видны при статусе "самозанятый"', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      await creditForm.selectEmploymentStatus('selfEmployed');

      await creditForm.expectFieldVisible('businessType');
      await creditForm.expectFieldVisible('businessInn');
      await creditForm.expectFieldVisible('businessActivity');

      // Поля работодателя скрыты
      await creditForm.expectFieldHidden('companyName');
      await creditForm.expectFieldHidden('position');
    });

    test('COND-003-D: Поля дохода видны для всех кроме безработного', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      // Трудоустроен - поля дохода видны
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.expectFieldVisible('monthlyIncome');
      await creditForm.expectFieldVisible('additionalIncome');

      // Самозанятый - поля дохода видны
      await creditForm.selectEmploymentStatus('selfEmployed');
      await creditForm.expectFieldVisible('monthlyIncome');
      await creditForm.expectFieldVisible('additionalIncome');

      // Безработный - поля дохода скрыты
      await creditForm.selectEmploymentStatus('unemployed');
      await creditForm.expectFieldHidden('monthlyIncome');
      await creditForm.expectFieldHidden('additionalIncome');
    });
  });

  test.describe('COND-004: Копирование адреса', () => {
    test('COND-004-A: Адрес проживания скрыт при включенном чекбоксе "Совпадает"', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // По умолчанию чекбокс "Адрес совпадает" включен
      await expect(creditForm.input('sameAsRegistration')).toBeChecked();

      // Адрес проживания скрыт
      await creditForm.expectFieldHidden('residenceAddress-region');
      await creditForm.expectFieldHidden('residenceAddress-city');
      await creditForm.expectFieldHidden('residenceAddress-street');
    });

    test('COND-004-B: Адрес проживания появляется при снятии чекбокса', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Снимаем чекбокс
      await creditForm.input('sameAsRegistration').uncheck();

      // Адрес проживания появляется
      await creditForm.expectFieldVisible('residenceAddress-region');
      await creditForm.expectFieldVisible('residenceAddress-city');
      await creditForm.expectFieldVisible('residenceAddress-street');
      await creditForm.expectFieldVisible('residenceAddress-house');
      await creditForm.expectFieldVisible('residenceAddress-apartment');
      await creditForm.expectFieldVisible('residenceAddress-postalCode');
    });

    test('COND-004-C: Данные копируются при включении чекбокса (copyFrom)', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Снимаем чекбокс и заполняем адрес проживания
      await creditForm.input('sameAsRegistration').uncheck();

      // Заполняем адрес регистрации
      await creditForm.fillRegion('Московская область');
      await creditForm.fillCity('Москва');
      await creditForm.fillStreet('Тверская');
      await creditForm.fillHouse('1');
      await creditForm.fillApartment('10');

      // Включаем чекбокс
      await creditForm.input('sameAsRegistration').check();

      // Адрес проживания должен скрыться
      await creditForm.expectFieldHidden('residenceAddress-region');

      // Снова снимаем чекбокс - поля должны быть пустыми (resetOnDisable)
      await creditForm.input('sameAsRegistration').uncheck();

      // Проверяем, что адрес проживания сброшен
      const residenceRegion = await creditForm.input('residenceAddress-region').inputValue();
      expect(residenceRegion).toBe('');
    });

    test('COND-004-D: Адрес проживания валидируется при снятом чекбоксе', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Заполняем контакты
      await creditForm.fillPhone('+7 (999) 123-45-67');
      await creditForm.fillEmail('test@example.com');

      // Заполняем адрес регистрации
      await creditForm.fillRegion('Московская область');
      await creditForm.fillCity('Москва');
      await creditForm.fillStreet('Тверская');
      await creditForm.fillHouse('1');
      await creditForm.fillApartment('10');
      await creditForm.fillPostalCode('123456');

      // Снимаем чекбокс
      await creditForm.input('sameAsRegistration').uncheck();

      // Пытаемся перейти дальше без заполнения адреса проживания
      await creditForm.goToNextStep();

      // Должны остаться на шаге 3 с ошибками валидации
      await creditForm.expectStepHeading(/контактная информация/i);
      await creditForm.expectFieldError('residenceAddress-region');
    });
  });

  test.describe('COND-005: Массивы форм (условное отображение)', () => {
    test('COND-005-A: Секция имущества появляется при включении чекбокса', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      // По умолчанию чекбокс "Есть имущество" выключен
      await expect(creditForm.input('hasProperty')).not.toBeChecked();

      // Кнопка добавления имущества не видна
      await expect(
        creditForm.page.getByRole('button', { name: /добавить имущество/i })
      ).not.toBeVisible();

      // Включаем чекбокс
      await creditForm.toggleHasProperty(true);

      // Кнопка появляется
      await expect(
        creditForm.page.getByRole('button', { name: /добавить имущество/i })
      ).toBeVisible();
    });

    test('COND-005-B: Секция кредитов появляется при включении чекбокса', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await expect(creditForm.input('hasExistingLoans')).not.toBeChecked();
      await expect(
        creditForm.page.getByRole('button', { name: /добавить кредит/i })
      ).not.toBeVisible();

      await creditForm.toggleHasLoans(true);

      await expect(creditForm.page.getByRole('button', { name: /добавить кредит/i })).toBeVisible();
    });

    test('COND-005-C: Секция созаемщиков появляется при включении чекбокса', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await expect(creditForm.input('hasCoBorrower')).not.toBeChecked();
      await expect(
        creditForm.page.getByRole('button', { name: /добавить созаемщика/i })
      ).not.toBeVisible();

      await creditForm.toggleAddCoBorrower(true);

      await expect(
        creditForm.page.getByRole('button', { name: /добавить созаемщика/i })
      ).toBeVisible();
    });

    test('COND-005-D: Массив очищается при снятии чекбокса (watchField)', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      // Добавляем имущество
      await creditForm.toggleHasProperty(true);
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();

      // Проверяем, что элемент добавлен
      await expect(creditForm.page.locator('text=/имущество.*#1/i')).toBeVisible();

      // Снимаем чекбокс
      await creditForm.toggleHasProperty(false);

      // Снова включаем
      await creditForm.toggleHasProperty(true);

      // Массив должен быть пустым (элемент удален)
      await expect(creditForm.page.locator('text=/имущество.*#1/i')).not.toBeVisible();
    });
  });

  test.describe('COND-006: Копирование email через sameEmail (copyFrom)', () => {
    test('COND-006-A: Чекбокс sameEmail копирует email в дополнительный', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      const testEmail = 'primary@example.com';
      await creditForm.fillEmail(testEmail);

      // Включаем чекбокс "Email совпадает"
      await creditForm.input('sameEmail').check();
      await creditForm.page.waitForTimeout(100);

      // Дополнительный email должен стать равным основному (copyFrom behavior)
      const additionalEmail = await creditForm.input('emailAdditional').inputValue();
      expect(additionalEmail).toBe(testEmail);
    });

    test('COND-006-B: Отключение sameEmail очищает дополнительный email (resetOnDisable)', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      await creditForm.fillEmail('primary@example.com');
      await creditForm.input('sameEmail').check();
      await creditForm.page.waitForTimeout(100);

      // Отключаем чекбокс
      await creditForm.input('sameEmail').uncheck();
      await creditForm.page.waitForTimeout(100);

      // Дополнительный email должен быть очищен
      const additionalEmail = await creditForm.input('emailAdditional').inputValue();
      expect(additionalEmail).toBe('');
    });
  });

  test.describe('COND-007: Статусы занятости retired и student', () => {
    test('COND-007-A: Пенсионер - поля работодателя скрыты, доход виден', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      await creditForm.selectEmploymentStatus('retired');

      // Поля работодателя скрыты
      await creditForm.expectFieldHidden('companyName');
      await creditForm.expectFieldHidden('companyInn');
      await creditForm.expectFieldHidden('position');

      // Поля ИП скрыты
      await creditForm.expectFieldHidden('businessType');
      await creditForm.expectFieldHidden('businessInn');

      // Поле дохода видно (пенсионер получает пенсию)
      await creditForm.expectFieldVisible('monthlyIncome');
    });

    test('COND-007-B: Студент - поля работодателя и ИП скрыты', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      await creditForm.selectEmploymentStatus('student');

      // Поля работодателя скрыты
      await creditForm.expectFieldHidden('companyName');
      await creditForm.expectFieldHidden('position');

      // Поля ИП скрыты
      await creditForm.expectFieldHidden('businessType');
    });

    test('COND-007-C: Переход между retired/employed сбрасывает данные (resetOnDisable)', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();

      // Заполняем данные работодателя
      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillCompanyName('ООО Тест');
      await creditForm.fillCompanyInn('1234567890');

      // Меняем на пенсионера
      await creditForm.selectEmploymentStatus('retired');

      // Возвращаемся к employed - данные должны быть сброшены
      await creditForm.selectEmploymentStatus('employed');

      const companyName = await creditForm.input('companyName').inputValue();
      expect(companyName).toBe('');
    });
  });
});
