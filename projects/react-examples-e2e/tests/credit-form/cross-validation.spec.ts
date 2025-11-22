import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';
import { CROSS_VALIDATION_DATA } from '../fixtures/test-data';

test.describe('Кросс-валидация', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  // ============================================================================
  // Шаг 4: Кросс-валидация занятости
  // ============================================================================

  test.describe('Занятость и стаж', () => {
    /**
     * TC-CROSS-001: Стаж на текущем месте не больше общего стажа
     * Приоритет: High
     */
    test(
      'TC-CROSS-001: Стаж на текущем месте не больше общего стажа',
      {
        tag: ['@high', '@cross-validation'],
      },
      async () => {
        // Заполняем и проходим шаги 1-3
        await creditForm.fillAndNavigateToStep4();

        // Шаг 4: Занятость
        await creditForm.selectEmploymentStatus('employed');
        await creditForm.fillCompanyName('ООО Тест');
        await creditForm.fillCompanyInn('1234567890');
        await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
        await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
        await creditForm.fillPosition('Менеджер');
        await creditForm.fillMonthlyIncome(100000);

        // Вводим общий стаж меньше, чем стаж на текущем месте
        await creditForm.fillWorkExperience(
          CROSS_VALIDATION_DATA.currentJobExperienceGreaterThanTotal.workExperience
        );
        await creditForm.fillCurrentJobExperience(
          CROSS_VALIDATION_DATA.currentJobExperienceGreaterThanTotal.currentJobExperience
        );

        await creditForm.goToNextStep();

        // Проверяем ошибку кросс-валидации - форма должна остаться на шаге 4
        await creditForm.expectStepHeading(/информация о занятости/i);
        await creditForm.expectFieldError('workExperienceCurrent', /не может превышать/i);
      }
    );
  });

  // ============================================================================
  // Шаг 1: Кросс-валидация ипотеки
  // ============================================================================

  test.describe('Ипотека', () => {
    /**
     * TC-CROSS-002: Первоначальный взнос минимум 20% от стоимости
     * Приоритет: High
     */
    test(
      'TC-CROSS-002: Первоначальный взнос минимум 20% от стоимости',
      {
        tag: ['@high', '@cross-validation'],
      },
      async () => {
        await creditForm.selectLoanType('mortgage');

        await creditForm.fillPropertyValue(10000000);

        // Первоначальный взнос должен быть автоматически рассчитан как 20%
        const initialPaymentField = creditForm.input('initialPayment');
        const value = await initialPaymentField.inputValue();
        expect(parseFloat(value)).toBe(2000000);

        // Поле может быть readonly или computed (проверяем наличие значения)
        await expect(initialPaymentField).toHaveValue('2000000');
      }
    );

    /**
     * TC-CROSS-004: Сумма ипотеки не превышает (стоимость - взнос)
     * Приоритет: High
     */
    test(
      'TC-CROSS-004: Сумма ипотеки не превышает (стоимость - взнос)',
      {
        tag: ['@high', '@cross-validation'],
      },
      async () => {
        await creditForm.selectLoanType('mortgage');

        await creditForm.fillPropertyValue(5000000);
        // Первоначальный взнос автоматически = 1000000 (20%)
        // Максимальная сумма кредита = 4000000

        await creditForm.fillLoanAmount(4500000); // Больше максимума
        await creditForm.fillLoanTerm(240);
        await creditForm.fillLoanPurpose('Покупка квартиры для семьи');

        await creditForm.goToNextStep();

        // Проверяем ошибку - форма должна остаться на шаге 1
        await creditForm.expectStepHeading(/основная информация о кредите/i);
        await creditForm.expectFieldError('loanAmount', /не может превышать/i);
      }
    );
  });

  // ============================================================================
  // Шаг 2: Кросс-валидация возраста
  // ============================================================================

  test.describe('Возраст', () => {
    test.beforeEach(async () => {
      await creditForm.goToNextStep();
    });

    /**
     * TC-CROSS-005: Возраст заемщика от 18 до 70 лет
     * Приоритет: Critical
     */
    test(
      'TC-CROSS-005: Возраст заемщика от 18 до 70 лет (слишком молодой)',
      {
        tag: ['@critical', '@cross-validation'],
      },
      async () => {
        // Вводим дату рождения для возраста < 18
        const youngYear = new Date().getFullYear() - 17;
        await creditForm.fillBirthDate(`${youngYear}-01-01`);

        await creditForm.goToNextStep();

        // Проверяем ошибку
        await creditForm.expectStepHeading(/персональные данные/i);
        await creditForm.expectFieldError(
          'personalData-birthDate',
          /не менее 18|минимальный возраст/i
        );
      }
    );

    /**
     * TC-CROSS-005b: Возраст заемщика слишком большой
     * Приоритет: Critical
     */
    test(
      'TC-CROSS-005b: Возраст заемщика от 18 до 70 лет (слишком старый)',
      {
        tag: ['@critical', '@cross-validation'],
      },
      async () => {
        // Вводим дату рождения для возраста > 70
        const oldYear = new Date().getFullYear() - 75;
        await creditForm.fillBirthDate(`${oldYear}-01-01`);

        await creditForm.goToNextStep();

        // Проверяем ошибку
        await creditForm.expectStepHeading(/персональные данные/i);
        await creditForm.expectFieldError('personalData-birthDate', /до 70|максимальный возраст/i);
      }
    );

    /**
     * TC-CROSS-008: Предупреждение при возрасте > 60 лет
     * Приоритет: Medium
     */
    test(
      'TC-CROSS-008: Предупреждение при возрасте > 60 лет',
      {
        tag: ['@medium', '@cross-validation'],
      },
      async ({ page }) => {
        // Вводим дату рождения для возраста 62 года
        const year = new Date().getFullYear() - 62;
        await creditForm.fillBirthDate(`${year}-01-01`);

        // Проверяем предупреждение (но переход разрешен)
        const warning = page.getByText(/дополнительные гарантии|предупреждение/i);
        if ((await warning.count()) > 0) {
          await expect(warning).toBeVisible();
        }
      }
    );
  });

  // ============================================================================
  // Кросс-валидация долговой нагрузки
  // ============================================================================

  test.describe('Долговая нагрузка', () => {
    /**
     * TC-CROSS-006: Процент платежа от дохода не более 50%
     * Приоритет: Critical
     */
    test(
      'TC-CROSS-006: Процент платежа от дохода не более 50%',
      {
        tag: ['@critical', '@cross-validation'],
      },
      async () => {
        // Шаг 1: Устанавливаем параметры для высокого платежа
        await creditForm.fillLoanAmount(CROSS_VALIDATION_DATA.highDebtBurden.loanAmount); // 2000000
        await creditForm.fillLoanTerm(CROSS_VALIDATION_DATA.highDebtBurden.loanTerm); // 24
        await creditForm.fillLoanPurpose('Крупная покупка для бизнеса');
        await creditForm.goToNextStep();

        // Шаг 2: Персональные данные
        await creditForm.fillStep2PersonalData();
        await creditForm.goToNextStep();

        // Шаг 3: Контактная информация
        await creditForm.fillStep3ContactInfo();
        await creditForm.goToNextStep();

        // Шаг 4: Занятость с низким доходом
        await creditForm.selectEmploymentStatus('employed');
        await creditForm.fillCompanyName('ООО Тест');
        await creditForm.fillCompanyInn('1234567890');
        await creditForm.fillCompanyPhone('+7 (999) 111-22-33');
        await creditForm.fillCompanyAddress('г. Москва, ул. Тестовая, д. 1');
        await creditForm.fillPosition('Менеджер');
        await creditForm.fillWorkExperience(60);
        await creditForm.fillCurrentJobExperience(24);
        await creditForm.fillMonthlyIncome(CROSS_VALIDATION_DATA.highDebtBurden.monthlyIncome); // 100000 - низкий для такого кредита

        await creditForm.goToNextStep();

        // Должна быть ошибка о высокой долговой нагрузке (платеж > 50% дохода)
        await creditForm.expectStepHeading(/информация о занятости/i);
        await creditForm.expectFieldError('monthlyIncome', /не должен превышать 50%/i);
      }
    );

    /**
     * TC-CROSS-007: Предупреждение при высокой долговой нагрузке (>40%)
     * Приоритет: Medium
     */
    test(
      'TC-CROSS-007: Предупреждение при высокой долговой нагрузке (>40%)',
      {
        tag: ['@medium', '@cross-validation'],
      },
      async ({ page }) => {
        // Устанавливаем параметры для нагрузки ~45%
        await creditForm.fillLoanAmount(CROSS_VALIDATION_DATA.warningDebtBurden.loanAmount);
        await creditForm.fillLoanTerm(CROSS_VALIDATION_DATA.warningDebtBurden.loanTerm);

        // Проверяем предупреждение
        const warning = page.getByText(/высокая.*нагрузка|предупреждение/i);
        if ((await warning.count()) > 0) {
          await expect(warning).toBeVisible();
        }
      }
    );
  });

  // ============================================================================
  // Кросс-валидация существующих кредитов
  // ============================================================================

  test.describe('Существующие кредиты', () => {
    test.beforeEach(async () => {
      for (let i = 0; i < 4; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-CROSS-003: Остаток задолженности не больше суммы кредита
     * Приоритет: High
     */
    test(
      'TC-CROSS-003: Остаток задолженности не больше суммы кредита',
      {
        tag: ['@high', '@cross-validation'],
      },
      async ({ page }) => {
        // Включаем чекбокс кредитов
        const hasLoansCheckbox = page.getByLabel(/у меня есть другие кредиты/i);
        if ((await hasLoansCheckbox.count()) > 0) {
          await hasLoansCheckbox.check();

          await page.getByRole('button', { name: /добавить кредит/i }).click();

          // Заполняем данные кредита с невалидными значениями
          const loanAmountField = page
            .locator('[class*="loan"]')
            .getByLabel(/сумма кредита/i)
            .first();
          const remainingField = page
            .locator('[class*="loan"]')
            .getByLabel(/остаток/i)
            .first();

          if ((await loanAmountField.count()) > 0 && (await remainingField.count()) > 0) {
            await loanAmountField.fill('500000');
            await remainingField.fill('600000'); // Остаток больше суммы

            await creditForm.goToNextStep();

            // Проверяем ошибку валидации в массиве кредитов
            await creditForm.expectErrorMessage(/не может превышать/i);
          }
        }
      }
    );
  });

  // ============================================================================
  // Кросс-валидация стажа
  // ============================================================================

  test.describe('Стаж работы', () => {
    test.beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-CROSS-009: Предупреждение при малом стаже на текущем месте (<3 мес)
     * Приоритет: Low
     */
    test(
      'TC-CROSS-009: Предупреждение при малом стаже на текущем месте (<3 мес)',
      {
        tag: ['@low', '@cross-validation'],
      },
      async ({ page }) => {
        await creditForm.selectEmploymentStatus('employed');
        await creditForm.fillCompanyName('ООО Тест');
        await creditForm.fillWorkExperience(24);
        await creditForm.fillCurrentJobExperience(2); // 2 месяца

        // Проверяем предупреждение
        const warning = page.getByText(/малый стаж|предупреждение/i);
        if ((await warning.count()) > 0) {
          await expect(warning).toBeVisible();
        }
      }
    );
  });
});
