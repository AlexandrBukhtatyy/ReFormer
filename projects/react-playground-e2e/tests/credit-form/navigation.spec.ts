import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Навигация между шагами', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  /**
   * TC-NAV-001: Переход на следующий шаг при валидных данных
   * Приоритет: Critical
   */
  test(
    'TC-NAV-001: Переход на следующий шаг при валидных данных',
    {
      tag: ['@critical', '@navigation'],
    },
    async () => {
      // Шаг 1
      await creditForm.expectStepHeading(/основная информация о кредите/i);

      // Заполняем обязательные поля
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Ремонт квартиры');

      // Переходим на шаг 2
      await creditForm.goToNextStep();

      // Проверяем что перешли
      await creditForm.expectStepHeading(/персональные данные/i);

      // Проверяем индикатор прогресса
      const currentStep = await creditForm.getCurrentStep();
      expect(currentStep).toBe(2);
    }
  );

  /**
   * TC-NAV-002: Блокировка перехода при невалидных данных
   * Приоритет: Critical
   */
  test(
    'TC-NAV-002: Блокировка перехода при невалидных данных',
    {
      tag: ['@critical', '@navigation'],
    },
    async () => {
      // Очищаем поля и пытаемся перейти
      await creditForm.page.getByLabel(/сумма кредита/i).clear();

      await creditForm.goToNextStep();

      // Проверяем что остались на шаге 1
      await creditForm.expectStepHeading(/основная информация о кредите/i);
      const currentStep = await creditForm.getCurrentStep();
      expect(currentStep).toBe(1);

      // Проверяем отображение ошибок
      await creditForm.expectFieldError(/сумма кредита/i);
    }
  );

  /**
   * TC-NAV-003: Возврат на предыдущий шаг без потери данных
   * Приоритет: Critical
   */
  test(
    'TC-NAV-003: Возврат на предыдущий шаг без потери данных',
    {
      tag: ['@critical', '@navigation'],
    },
    async () => {
      const testAmount = 750000;
      const testTerm = 36;
      const testPurpose = 'Покупка мебели для дома';

      // Заполняем шаг 1
      await creditForm.fillLoanAmount(testAmount);
      await creditForm.fillLoanTerm(testTerm);
      await creditForm.fillLoanPurpose(testPurpose);

      // Переходим на шаг 2
      await creditForm.goToNextStep();
      await creditForm.expectStepHeading(/персональные данные/i);

      // Заполняем что-то на шаге 2
      await creditForm.fillLastName('Тестов');

      // Возвращаемся на шаг 1
      await creditForm.goToPreviousStep();
      await creditForm.expectStepHeading(/основная информация о кредите/i);

      // Проверяем что данные сохранились
      await creditForm.expectFieldValue(/сумма кредита/i, String(testAmount));
      await creditForm.expectFieldValue(/срок кредита/i, String(testTerm));
      await creditForm.expectFieldValue(/цель кредита/i, testPurpose);

      // Возвращаемся на шаг 2 и проверяем данные
      await creditForm.goToNextStep();
      await creditForm.expectFieldValue(/фамилия/i, 'Тестов');
    }
  );

  /**
   * TC-NAV-004: Индикатор прогресса отражает текущий шаг
   * Приоритет: High
   */
  test(
    'TC-NAV-004: Индикатор прогресса отражает текущий шаг',
    {
      tag: ['@high', '@navigation'],
    },
    async ({ page }) => {
      // Проверяем индикатор на шаге 1
      let stepText = await page.locator('text=/Шаг \\d+ из/').textContent();
      expect(stepText).toContain('Шаг 1 из 6');

      // Переходим на шаг 2
      await creditForm.goToNextStep();
      stepText = await page.locator('text=/Шаг \\d+ из/').textContent();
      expect(stepText).toContain('Шаг 2 из 6');

      // Возвращаемся на шаг 1
      await creditForm.goToPreviousStep();
      stepText = await page.locator('text=/Шаг \\d+ из/').textContent();
      expect(stepText).toContain('Шаг 1 из 6');
    }
  );

  /**
   * TC-NAV-005: Прямая навигация к пройденному шагу
   * Приоритет: Medium
   */
  test(
    'TC-NAV-005: Прямая навигация к пройденному шагу',
    {
      tag: ['@medium', '@navigation'],
    },
    async ({ page }) => {
      // Проходим до шага 4
      for (let i = 0; i < 3; i++) {
        await creditForm.goToNextStep();
      }

      // Кликаем на индикатор шага 2
      const step2Indicator = page.locator('[class*="step"]').filter({ hasText: '2' }).first();
      if (await step2Indicator.isVisible()) {
        await step2Indicator.click();
        await page.waitForTimeout(300);

        // Проверяем что перешли на шаг 2
        const currentStep = await creditForm.getCurrentStep();
        expect(currentStep).toBe(2);
      }
    }
  );

  /**
   * TC-NAV-006: Запрет перехода к непройденным шагам
   * Приоритет: Medium
   */
  test(
    'TC-NAV-006: Запрет перехода к непройденным шагам',
    {
      tag: ['@medium', '@navigation'],
    },
    async ({ page }) => {
      // Находимся на шаге 1, пытаемся перейти на шаг 4
      const step4Indicator = page.locator('[class*="step"]').filter({ hasText: '4' }).first();

      if (await step4Indicator.isVisible()) {
        await step4Indicator.click();
        await page.waitForTimeout(300);

        // Проверяем что остались на шаге 1
        const currentStep = await creditForm.getCurrentStep();
        expect(currentStep).toBe(1);
      }
    }
  );
});
