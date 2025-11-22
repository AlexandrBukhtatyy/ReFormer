import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Вычисляемые поля (Computed Fields)', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  // ============================================================================
  // Шаг 1: Вычисляемые поля кредита
  // ============================================================================

  /**
   * TC-COMP-001: Автоматический расчет процентной ставки
   * Приоритет: High
   */
  test(
    'TC-COMP-001: Автоматический расчет процентной ставки',
    {
      tag: ['@high', '@computed'],
    },
    async () => {
      // Выбираем потребительский кредит
      await creditForm.selectLoanType('consumer');

      // Проверяем что процентная ставка рассчитана
      const rateField = creditForm.input('interestRate');
      if ((await rateField.count()) > 0) {
        const consumerRate = await rateField.inputValue();
        expect(consumerRate).not.toBe('');

        // Меняем на ипотеку
        await creditForm.selectLoanType('mortgage');
        const mortgageRate = await rateField.inputValue();

        // Ставки должны различаться
        expect(mortgageRate).not.toBe(consumerRate);

        // Поле должно быть readonly
        await creditForm.expectFieldDisabled('interestRate');
      }
    }
  );

  /**
   * TC-COMP-002: Автоматический расчет ежемесячного платежа
   * Приоритет: Critical
   */
  test(
    'TC-COMP-002: Автоматический расчет ежемесячного платежа',
    {
      tag: ['@critical', '@computed'],
    },
    async () => {
      await creditForm.fillLoanAmount(1000000);
      await creditForm.fillLoanTerm(12);

      // Проверяем ежемесячный платеж
      const paymentField = creditForm.input('monthlyPayment');
      if ((await paymentField.count()) > 0) {
        const payment1 = await paymentField.inputValue();
        expect(payment1).not.toBe('');
        expect(parseFloat(payment1)).toBeGreaterThan(0);

        // Меняем сумму
        await creditForm.fillLoanAmount(2000000);
        await creditForm.page.waitForTimeout(300); // Ждём пересчета

        const payment2 = await paymentField.inputValue();
        expect(parseFloat(payment2)).toBeGreaterThan(parseFloat(payment1));

        // Поле должно быть readonly
        await creditForm.expectFieldDisabled('monthlyPayment');
      }
    }
  );

  /**
   * TC-COMP-003: Автоматический расчет первоначального взноса (ипотека)
   * Приоритет: High
   */
  test(
    'TC-COMP-003: Автоматический расчет первоначального взноса (ипотека)',
    {
      tag: ['@high', '@computed'],
    },
    async () => {
      await creditForm.selectLoanType('mortgage');

      // Вводим стоимость недвижимости
      await creditForm.fillPropertyValue(10000000);
      await creditForm.page.waitForTimeout(300);

      // Проверяем первоначальный взнос (20%)
      const expectedPayment = 2000000; // 20% от 10000000

      await creditForm.expectFieldValue('initialPayment', String(expectedPayment));

      // Поле должно быть readonly
      await creditForm.expectFieldDisabled('initialPayment');

      // При изменении стоимости взнос должен пересчитаться
      await creditForm.fillPropertyValue(5000000);
      await creditForm.page.waitForTimeout(300);

      await creditForm.expectFieldValue('initialPayment', String(1000000)); // 20% от 5000000
    }
  );

  // ============================================================================
  // Шаг 2: Вычисляемые поля персональных данных
  // ============================================================================

  test.describe('Персональные данные', () => {
    test.beforeEach(async () => {
      await creditForm.goToNextStep();
    });

    /**
     * TC-COMP-004: Вычисление полного имени
     * Приоритет: Medium
     */
    test(
      'TC-COMP-004: Вычисление полного имени',
      {
        tag: ['@medium', '@computed'],
      },
      async () => {
        await creditForm.fillLastName('Иванов');
        await creditForm.fillFirstName('Иван');
        await creditForm.fillMiddleName('Иванович');

        // Проверяем полное имя
        const fullNameField = creditForm.input('fullName');
        if ((await fullNameField.count()) > 0) {
          const fullName = await fullNameField.inputValue();
          expect(fullName).toBe('Иванов Иван Иванович');

          // Поле должно быть readonly
          await creditForm.expectFieldDisabled('fullName');
        }
      }
    );

    /**
     * TC-COMP-005: Вычисление возраста из даты рождения
     * Приоритет: High
     */
    test(
      'TC-COMP-005: Вычисление возраста из даты рождения',
      {
        tag: ['@high', '@computed'],
      },
      async () => {
        // Вводим дату рождения (примерно 30 лет назад)
        const birthYear = new Date().getFullYear() - 30;
        await creditForm.fillBirthDate(`${birthYear}-05-15`);

        // Проверяем возраст
        const ageField = creditForm.input('age');
        if ((await ageField.count()) > 0) {
          const age = await ageField.inputValue();
          expect(parseInt(age)).toBeGreaterThanOrEqual(29);
          expect(parseInt(age)).toBeLessThanOrEqual(31);

          // Поле должно быть readonly
          await creditForm.expectFieldDisabled('age');
        }
      }
    );
  });

  // ============================================================================
  // Шаг 4: Вычисляемые поля дохода
  // ============================================================================

  test.describe('Доход', () => {
    test.beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-COMP-006: Вычисление общего дохода
     * Приоритет: High
     */
    test(
      'TC-COMP-006: Вычисление общего дохода',
      {
        tag: ['@high', '@computed'],
      },
      async () => {
        await creditForm.selectEmploymentStatus('employed');
        await creditForm.fillMonthlyIncome(100000);
        await creditForm.fillAdditionalIncome(20000);

        // Проверяем общий доход
        const totalIncomeField = creditForm.input('totalIncome');
        if ((await totalIncomeField.count()) > 0) {
          const totalIncome = await totalIncomeField.inputValue();
          expect(parseFloat(totalIncome)).toBe(120000);

          // Поле должно быть readonly
          await creditForm.expectFieldDisabled('totalIncome');
        }
      }
    );

    /**
     * TC-COMP-007: Вычисление процента платежа от дохода
     * Приоритет: High
     */
    test(
      'TC-COMP-007: Вычисление процента платежа от дохода',
      {
        tag: ['@high', '@computed'],
      },
      async () => {
        await creditForm.selectEmploymentStatus('employed');
        await creditForm.fillMonthlyIncome(100000);

        // Проверяем процент платежа от дохода
        const ratioField = creditForm.input('paymentToIncomeRatio');
        if ((await ratioField.count()) > 0) {
          const ratio = await ratioField.inputValue();
          expect(ratio).not.toBe('');

          // Поле должно быть readonly
          await creditForm.expectFieldDisabled('paymentToIncomeRatio');
        }
      }
    );
  });

  // ============================================================================
  // Шаг 5: Вычисляемые поля созаемщиков
  // ============================================================================

  test.describe('Созаемщики', () => {
    test.beforeEach(async () => {
      for (let i = 0; i < 4; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-COMP-008: Вычисление дохода созаемщиков
     * Приоритет: Medium
     */
    test(
      'TC-COMP-008: Вычисление дохода созаемщиков',
      {
        tag: ['@medium', '@computed'],
      },
      async ({ page }) => {
        // Включаем созаемщиков
        const addCoBorrowerCheckbox = creditForm.input('addCoBorrower');

        if ((await addCoBorrowerCheckbox.count()) > 0) {
          await addCoBorrowerCheckbox.check();

          // Добавляем созаемщика
          await page.getByRole('button', { name: /добавить созаемщика/i }).click();

          // Заполняем доход созаемщика
          const coBorrowerIncomeField = page
            .locator('[class*="co-borrower"]')
            .locator('[data-testid*="income"]')
            .first();
          if ((await coBorrowerIncomeField.count()) > 0) {
            await coBorrowerIncomeField.fill('50000');

            // Проверяем суммарный доход созаемщиков
            const totalCoBorrowerIncomeField = creditForm.input('totalCoBorrowerIncome');
            if ((await totalCoBorrowerIncomeField.count()) > 0) {
              const totalIncome = await totalCoBorrowerIncomeField.inputValue();
              expect(parseFloat(totalIncome)).toBe(50000);
            }
          }
        }
      }
    );
  });
});
