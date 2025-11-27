import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Edge Cases', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  /**
   * TC-EDGE-001: Очень длинные значения в текстовых полях
   * Приоритет: Medium
   */
  test(
    'TC-EDGE-001: Очень длинные значения в текстовых полях',
    {
      tag: ['@medium', '@edge-cases'],
    },
    async () => {
      // Генерируем длинную строку (500 символов)
      const longText = 'А'.repeat(500);

      await creditForm.fillLoanPurpose(longText);

      // Проверяем что ввод ограничен или принят
      const value = await creditForm.input('loanPurpose').inputValue();

      // Значение должно быть не пустым
      expect(value.length).toBeGreaterThan(0);
      // И либо полным, либо обрезанным до максимума
      expect(value.length).toBeLessThanOrEqual(500);
    }
  );

  /**
   * TC-EDGE-002: Специальные символы в текстовых полях
   * Приоритет: Medium
   */
  test(
    'TC-EDGE-002: Специальные символы в текстовых полях',
    {
      tag: ['@medium', '@edge-cases'],
    },
    async () => {
      await creditForm.goToNextStep();

      // Вводим ФИО со специальными символами
      await creditForm.fillLastName("О'Коннор-Смит");
      await creditForm.expectFieldValue('personalData-lastName', "О'Коннор-Смит");

      // Проверяем что нет XSS
      await creditForm.fillLastName('<script>alert(1)</script>');
      // Должно быть экранировано или отклонено
      expect(creditForm.hasNoErrors()).toBe(true);
    }
  );

  /**
   * TC-EDGE-003: Нулевые значения в числовых полях
   * Приоритет: Medium
   */
  test(
    'TC-EDGE-003: Нулевые значения в числовых полях',
    {
      tag: ['@medium', '@edge-cases'],
    },
    async () => {
      // Переходим на шаг 4 для проверки дополнительного дохода
      for (let i = 0; i < 3; i++) {
        await creditForm.goToNextStep();
      }

      await creditForm.selectEmploymentStatus('employed');
      await creditForm.fillMonthlyIncome(100000);
      await creditForm.fillAdditionalIncome(0);

      // Значение 0 должно быть принято для необязательного поля
      await creditForm.expectFieldValue('additionalIncome', '0');
    }
  );

  /**
   * TC-EDGE-004: Отрицательные значения в числовых полях
   * Приоритет: Medium
   */
  test(
    'TC-EDGE-004: Отрицательные значения в числовых полях',
    {
      tag: ['@medium', '@edge-cases'],
    },
    async () => {
      // Пытаемся ввести отрицательное значение
      const loanAmountField = creditForm.input('loanAmount');
      await loanAmountField.fill('-100000');

      // Значение не должно быть отрицательным
      const value = await loanAmountField.inputValue();
      expect(parseFloat(value)).toBeGreaterThanOrEqual(0);
    }
  );

  /**
   * TC-EDGE-005: Дата рождения в будущем
   * Приоритет: Medium
   */
  test(
    'TC-EDGE-005: Дата рождения в будущем',
    {
      tag: ['@medium', '@edge-cases'],
    },
    async () => {
      await creditForm.goToNextStep();

      // Вводим дату в будущем
      await creditForm.fillBirthDate('2030-01-01');
      await creditForm.goToNextStep();

      // Должна быть ошибка валидации
      await creditForm.expectStepHeading(/персональные данные/i);
      await creditForm.expectFieldError('personalData-birthDate');
    }
  );

  /**
   * TC-EDGE-006: Дата рождения слишком давно
   * Приоритет: Low
   */
  test(
    'TC-EDGE-006: Дата рождения слишком давно',
    {
      tag: ['@low', '@edge-cases'],
    },
    async () => {
      await creditForm.goToNextStep();

      // Вводим дату для возраста > 100 лет
      await creditForm.fillBirthDate('1900-01-01');
      await creditForm.goToNextStep();

      // Должна быть ошибка (возраст > 70)
      await creditForm.expectStepHeading(/персональные данные/i);
      await creditForm.expectFieldError('personalData-birthDate');
    }
  );

  /**
   * TC-EDGE-007: Быстрое переключение между шагами
   * Приоритет: Medium
   */
  test(
    'TC-EDGE-007: Быстрое переключение между шагами',
    {
      tag: ['@medium', '@edge-cases'],
    },
    async () => {
      // Быстро переключаемся между шагами
      for (let i = 0; i < 5; i++) {
        await creditForm.goToNextStep();
        await creditForm.page.waitForTimeout(50); // Минимальная задержка
      }

      for (let i = 0; i < 5; i++) {
        await creditForm.goToPreviousStep();
        await creditForm.page.waitForTimeout(50);
      }

      // Форма должна работать стабильно
      expect(creditForm.hasNoErrors()).toBe(true);
      await creditForm.expectStepHeading(/основная информация о кредите/i);
    }
  );

  /**
   * TC-EDGE-008: Множественные клики на кнопку отправки
   * Приоритет: High
   */
  test(
    'TC-EDGE-008: Множественные клики на кнопку отправки',
    {
      tag: ['@high', '@edge-cases'],
    },
    async ({ page }) => {
      // Переходим на последний шаг
      for (let i = 0; i < 5; i++) {
        await creditForm.goToNextStep();
      }

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.fillSmsCode('123456');

      // Быстро кликаем несколько раз
      const submitButton = page.getByRole('button', { name: /отправить заявку/i });

      // Первый клик
      await submitButton.click();

      // Кнопка должна быть заблокирована или показан лоадер
      // Пытаемся кликнуть ещё раз
      try {
        await submitButton.click({ timeout: 100 });
      } catch {
        // Ожидаемо - кнопка заблокирована
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    }
  );

  /**
   * TC-EDGE-009: Потеря соединения во время заполнения
   * Приоритет: Medium
   *
   * Примечание: Требует network throttling/offline mode
   */
  test(
    'TC-EDGE-009: Потеря соединения во время заполнения',
    {
      tag: ['@medium', '@edge-cases'],
    },
    async ({ context }) => {
      // Заполняем несколько шагов
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Тестовая цель кредита');

      await creditForm.goToNextStep();

      // Симулируем offline режим
      await context.setOffline(true);

      // Пытаемся продолжить работу
      await creditForm.fillLastName('Тестов');

      // Данные должны сохраняться локально
      await creditForm.expectFieldValue('personalData-lastName', 'Тестов');

      // Восстанавливаем соединение
      await context.setOffline(false);

      // Возвращаемся назад и проверяем данные
      await creditForm.goToPreviousStep();
      await creditForm.expectFieldValue('loanAmount', '500000');
    }
  );
});
