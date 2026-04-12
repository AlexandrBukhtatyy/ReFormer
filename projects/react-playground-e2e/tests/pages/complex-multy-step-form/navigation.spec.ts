/**
 * Navigation E2E Tests
 *
 * Тесты навигации по шагам формы:
 * - Переход вперед
 * - Переход назад
 * - Блокировка при ошибках
 * - Индикатор шагов
 */

import { test, expect } from '../../shared/test-factory';

test.describe('Navigation', { tag: ['@navigation'] }, () => {
  test.describe('NAV-001: Переход вперед', () => {
    test('NAV-001-A: Успешный переход с шага 1 на шаг 2', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.expectStepHeading(/основная информация о кредите/i);

      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      await creditForm.expectStepHeading(/персональные данные/i);
      expect(await creditForm.getCurrentStep()).toBe(2);
    });

    test('NAV-001-B: Последовательный переход через все шаги', async ({ creditForm }) => {
      await creditForm.goto();

      // Шаг 1 -> 2
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      expect(await creditForm.getCurrentStep()).toBe(2);

      // Шаг 2 -> 3
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();
      expect(await creditForm.getCurrentStep()).toBe(3);

      // Шаг 3 -> 4
      await creditForm.fillStep3ContactInfo();
      await creditForm.goToNextStep();
      expect(await creditForm.getCurrentStep()).toBe(4);

      // Шаг 4 -> 5
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
      expect(await creditForm.getCurrentStep()).toBe(5);

      // Шаг 5 -> 6
      await creditForm.fillStep5AdditionalInfo();
      await creditForm.goToNextStep();
      expect(await creditForm.getCurrentStep()).toBe(6);

      // Проверяем, что на шаге 6 кнопка "Далее" заменена на "Отправить"
      await expect(creditForm.submitButton).toBeVisible();
      await expect(creditForm.nextButton).not.toBeVisible();
    });

    test('NAV-001-C: Данные сохраняются при переходе вперед', async ({ creditForm }) => {
      await creditForm.goto();

      const testAmount = 750000;
      const testTerm = 36;

      await creditForm.fillLoanAmount(testAmount);
      await creditForm.fillLoanTerm(testTerm);
      await creditForm.fillLoanPurpose('Тестовая цель кредита');
      await creditForm.goToNextStep();

      // Возвращаемся назад
      await creditForm.goToPreviousStep();

      // Проверяем сохранение данных
      await creditForm.expectFieldValue('loanAmount', String(testAmount));
      await creditForm.expectFieldValue('loanTerm', String(testTerm));
    });
  });

  test.describe('NAV-002: Блокировка перехода при ошибках валидации', () => {
    test('NAV-002-A: Блокировка при пустых обязательных полях', async ({ creditForm }) => {
      await creditForm.goto();

      // Очищаем все поля
      await creditForm.input('loanAmount').clear();
      await creditForm.input('loanTerm').clear();
      await creditForm.input('loanPurpose').clear();

      // Пытаемся перейти
      await creditForm.goToNextStep();

      // Остаемся на шаге 1
      expect(await creditForm.getCurrentStep()).toBe(1);
      await creditForm.expectStepHeading(/основная информация о кредите/i);
    });

    test('NAV-002-B: Блокировка при невалидных данных', async ({ creditForm }) => {
      await creditForm.goto();

      // Вводим невалидные данные
      await creditForm.fillLoanAmount(10000); // Меньше минимума
      await creditForm.fillLoanTerm(3); // Меньше минимума
      await creditForm.fillLoanPurpose('Тест'); // Меньше 10 символов

      await creditForm.goToNextStep();

      // Остаемся на шаге 1
      expect(await creditForm.getCurrentStep()).toBe(1);
    });

    test('NAV-002-C: Переход возможен после исправления ошибок', async ({ creditForm }) => {
      await creditForm.goto();

      // Вводим невалидные данные
      await creditForm.fillLoanAmount(10000);
      await creditForm.goToNextStep();

      // Проверяем, что остались на шаге 1
      expect(await creditForm.getCurrentStep()).toBe(1);

      // Исправляем данные
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Тестовая цель для кредита');
      await creditForm.goToNextStep();

      // Теперь переход успешен
      expect(await creditForm.getCurrentStep()).toBe(2);
    });
  });

  test.describe('NAV-003: Переход назад', () => {
    test('NAV-003-A: Кнопка "Назад" недоступна на первом шаге', async ({ creditForm }) => {
      await creditForm.goto();

      // На первом шаге кнопка "Назад" должна быть скрыта или отключена
      const prevButtonVisible = await creditForm.prevButton.isVisible();
      if (prevButtonVisible) {
        await expect(creditForm.prevButton).toBeDisabled();
      }
    });

    test('NAV-003-B: Переход назад со второго шага', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      expect(await creditForm.getCurrentStep()).toBe(2);
      await expect(creditForm.prevButton).toBeVisible();
      await expect(creditForm.prevButton).toBeEnabled();

      await creditForm.goToPreviousStep();

      expect(await creditForm.getCurrentStep()).toBe(1);
    });

    test('NAV-003-C: Переход назад сохраняет данные', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Заполняем данные на шаге 2
      await creditForm.fillLastName('Тестов');
      await creditForm.fillFirstName('Тест');
      await creditForm.fillMiddleName('Тестович');

      // Возвращаемся назад
      await creditForm.goToPreviousStep();
      // Идем снова вперед
      await creditForm.goToNextStep();

      // Данные должны сохраниться
      await creditForm.expectFieldValue('personalData-lastName', 'Тестов');
      await creditForm.expectFieldValue('personalData-firstName', 'Тест');
      await creditForm.expectFieldValue('personalData-middleName', 'Тестович');
    });

    test('NAV-003-D: Переход назад с любого шага', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      // Проверяем, что мы на шаге 6
      expect(await creditForm.getCurrentStep()).toBe(6);

      // Возвращаемся на шаг 5
      await creditForm.goToPreviousStep();
      expect(await creditForm.getCurrentStep()).toBe(5);

      // Возвращаемся на шаг 4
      await creditForm.goToPreviousStep();
      expect(await creditForm.getCurrentStep()).toBe(4);

      // Возвращаемся на шаг 3
      await creditForm.goToPreviousStep();
      expect(await creditForm.getCurrentStep()).toBe(3);

      // Возвращаемся на шаг 2
      await creditForm.goToPreviousStep();
      expect(await creditForm.getCurrentStep()).toBe(2);

      // Возвращаемся на шаг 1
      await creditForm.goToPreviousStep();
      expect(await creditForm.getCurrentStep()).toBe(1);
    });
  });

  test.describe('NAV-004: Индикатор шагов', () => {
    test('NAV-004-A: Индикатор отображает текущий шаг', async ({ creditForm }) => {
      await creditForm.goto();

      // Проверяем отображение "Шаг 1 из 6"
      await expect(creditForm.page.locator('text=/Шаг 1 из 6/i')).toBeVisible();

      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      await expect(creditForm.page.locator('text=/Шаг 2 из 6/i')).toBeVisible();
    });

    test('NAV-004-B: Индикатор показывает все 6 шагов', async ({ creditForm }) => {
      await creditForm.goto();

      // Проверяем наличие всех номеров шагов в индикаторе
      for (let i = 1; i <= 6; i++) {
        await expect(
          creditForm.page
            .locator(`[class*="step"]`)
            .filter({ hasText: String(i) })
            .first()
        ).toBeVisible();
      }
    });

    test('NAV-004-C: Клик по пройденному шагу возвращает назад', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();
      await creditForm.fillStep2PersonalData();
      await creditForm.goToNextStep();

      // Сейчас на шаге 3
      expect(await creditForm.getCurrentStep()).toBe(3);

      // Кликаем по индикатору шага 1
      await creditForm.goToStep(1);

      // Должны вернуться на шаг 1
      expect(await creditForm.getCurrentStep()).toBe(1);
    });

    test('NAV-004-D: Клик по будущему шагу не работает без заполнения текущего', async ({
      creditForm,
    }) => {
      await creditForm.goto();

      // На шаге 1, пытаемся кликнуть на шаг 3
      const step3 = creditForm.page.locator('[class*="step"]').filter({ hasText: '3' }).first();

      // Проверяем, что шаг 3 отключен или клик не работает
      const isDisabled = await step3.evaluate((el) => {
        return (
          el.hasAttribute('disabled') ||
          el.classList.contains('disabled') ||
          el.classList.contains('opacity-50') ||
          el.getAttribute('aria-disabled') === 'true'
        );
      });

      if (!isDisabled) {
        // Если элемент кликабелен, проверяем что переход не происходит
        await step3.click();
        await creditForm.page.waitForTimeout(300);
        expect(await creditForm.getCurrentStep()).toBe(1);
      }
    });

    test('NAV-004-E: Прогресс-бар обновляется при переходах', async ({ creditForm }) => {
      await creditForm.goto();

      // Ищем элемент прогресс-бара
      const progressBar = creditForm.page.locator('[class*="progress"]').first();
      const hasProgressBar = await progressBar.isVisible().catch(() => false);

      if (hasProgressBar) {
        // Получаем начальную ширину
        const initialWidth = await progressBar.evaluate(
          (el) => getComputedStyle(el).width || el.style.width
        );

        await creditForm.fillStep1ConsumerLoan();
        await creditForm.goToNextStep();

        // Проверяем, что прогресс изменился
        const newWidth = await progressBar.evaluate(
          (el) => getComputedStyle(el).width || el.style.width
        );

        // Ширина должна увеличиться
        expect(parseFloat(newWidth)).toBeGreaterThan(parseFloat(initialWidth));
      }
    });
  });

  test.describe('NAV-005: Состояние кнопок навигации', () => {
    test('NAV-005-A: На первом шаге отображается только кнопка "Далее"', async ({ creditForm }) => {
      await creditForm.goto();

      await expect(creditForm.nextButton).toBeVisible();
      // Кнопка "Назад" либо скрыта, либо отключена
      const prevVisible = await creditForm.prevButton.isVisible().catch(() => false);
      if (prevVisible) {
        await expect(creditForm.prevButton).toBeDisabled();
      }
    });

    test('NAV-005-B: На промежуточных шагах отображаются обе кнопки', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      await expect(creditForm.nextButton).toBeVisible();
      await expect(creditForm.prevButton).toBeVisible();
      await expect(creditForm.prevButton).toBeEnabled();
    });

    test('NAV-005-C: На последнем шаге отображается кнопка "Отправить"', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      await expect(creditForm.submitButton).toBeVisible();
      await expect(creditForm.nextButton).not.toBeVisible();
      await expect(creditForm.prevButton).toBeVisible();
    });
  });
});
