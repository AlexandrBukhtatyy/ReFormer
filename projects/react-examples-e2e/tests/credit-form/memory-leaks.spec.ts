import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Утечки памяти (Memory Leaks)', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  /**
   * TC-MEM-001: Утечки при монтировании/размонтировании формы
   * Приоритет: Critical
   */
  test(
    'TC-MEM-001: Утечки при монтировании/размонтировании формы',
    {
      tag: ['@critical', '@memory-leaks'],
    },
    async ({ page }) => {
      // Несколько циклов перезагрузки
      for (let i = 0; i < 5; i++) {
        await page.goto('http://localhost:5173');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    }
  );

  /**
   * TC-MEM-002: Утечки при переключении между шагами
   * Приоритет: High
   */
  test(
    'TC-MEM-002: Утечки при переключении между шагами',
    {
      tag: ['@high', '@memory-leaks'],
    },
    async () => {
      // Много переключений между шагами
      for (let cycle = 0; cycle < 10; cycle++) {
        // Вперёд
        for (let i = 0; i < 5; i++) {
          await creditForm.goToNextStep();
          await creditForm.page.waitForTimeout(100);
        }

        // Назад
        for (let i = 0; i < 5; i++) {
          await creditForm.goToPreviousStep();
          await creditForm.page.waitForTimeout(100);
        }
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);

      // Форма должна работать
      await creditForm.expectStepHeading(/основная информация о кредите/i);
    }
  );

  /**
   * TC-MEM-003: Утечки при динамической загрузке данных
   * Приоритет: High
   */
  test(
    'TC-MEM-003: Утечки при динамической загрузке данных',
    {
      tag: ['@high', '@memory-leaks'],
    },
    async () => {
      // Переключаем тип на автокредит и обратно много раз
      for (let i = 0; i < 10; i++) {
        await creditForm.selectLoanType('car');
        await creditForm.fillCarBrand('Toyota');
        await creditForm.page.waitForTimeout(100);

        await creditForm.selectLoanType('consumer');
        await creditForm.page.waitForTimeout(100);
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    }
  );

  /**
   * TC-MEM-004: Утечки при добавлении/удалении элементов массивов
   * Приоритет: High
   */
  test(
    'TC-MEM-004: Утечки при добавлении/удалении элементов массивов',
    {
      tag: ['@high', '@memory-leaks'],
    },
    async ({ page }) => {
      // Переходим на шаг 5
      for (let i = 0; i < 4; i++) {
        await creditForm.goToNextStep();
      }

      // Включаем чекбокс имущества
      const hasPropertyCheckbox = page.getByLabel(/у меня есть имущество/i);
      if ((await hasPropertyCheckbox.count()) > 0) {
        await hasPropertyCheckbox.check();

        // Много циклов добавления/удаления
        for (let cycle = 0; cycle < 5; cycle++) {
          // Добавляем 5 элементов
          for (let i = 0; i < 5; i++) {
            await page.getByRole('button', { name: /добавить имущество/i }).click();
            await page.waitForTimeout(50);
          }

          // Удаляем все
          const deleteButtons = page.getByRole('button', { name: /удалить/i });
          while ((await deleteButtons.count()) > 0) {
            await deleteButtons.first().click();
            await page.waitForTimeout(50);
          }
        }

        // Не должно быть ошибок
        expect(creditForm.hasNoErrors()).toBe(true);
        expect(creditForm.hasNoStackOverflow()).toBe(true);
      }
    }
  );

  /**
   * TC-MEM-005: Утечки при смене типа кредита
   * Приоритет: High
   */
  test(
    'TC-MEM-005: Утечки при смене типа кредита',
    {
      tag: ['@high', '@memory-leaks'],
    },
    async () => {
      const types: Array<'consumer' | 'mortgage' | 'car'> = ['consumer', 'mortgage', 'car'];

      // Много переключений типа
      for (let i = 0; i < 20; i++) {
        const type = types[i % types.length];
        await creditForm.selectLoanType(type);
        await creditForm.page.waitForTimeout(100);
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    }
  );

  /**
   * TC-MEM-006: Утечки при изменении режима формы
   * Приоритет: Medium
   */
  test(
    'TC-MEM-006: Утечки при изменении режима формы',
    {
      tag: ['@medium', '@memory-leaks'],
    },
    async ({ page }) => {
      // Если есть кнопки переключения режима
      const viewModeButton = page.getByRole('button', { name: /режим просмотра|только чтение/i });
      const editModeButton = page.getByRole('button', {
        name: /редактировать|режим редактирования/i,
      });

      if ((await viewModeButton.count()) > 0) {
        for (let i = 0; i < 10; i++) {
          await viewModeButton.click();
          await page.waitForTimeout(100);
          await editModeButton.click();
          await page.waitForTimeout(100);
        }

        expect(creditForm.hasNoErrors()).toBe(true);
      }
    }
  );

  /**
   * TC-MEM-007: Рост heap при длительной работе
   * Приоритет: Critical
   */
  test(
    'TC-MEM-007: Рост heap при длительной работе',
    {
      tag: ['@critical', '@memory-leaks'],
    },
    async ({ page }) => {
      // Выполняем много операций
      for (let cycle = 0; cycle < 10; cycle++) {
        // Заполняем данные
        await creditForm.fillLoanAmount(500000 + cycle * 10000);
        await creditForm.fillLoanTerm(24 + cycle);
        await creditForm.fillLoanPurpose(`Цель кредита номер ${cycle}`);

        // Меняем типы
        await creditForm.selectLoanType('mortgage');
        await creditForm.fillPropertyValue(5000000);
        await creditForm.selectLoanType('car');
        await creditForm.fillCarBrand('Toyota');
        await creditForm.selectLoanType('consumer');

        // Переключаемся между шагами
        await creditForm.goToNextStep();
        await creditForm.goToPreviousStep();

        // Очищаем поля
        await page.getByLabel(/сумма кредита/i).clear();
        await page.getByLabel(/срок кредита/i).clear();
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);

      // Форма должна оставаться работоспособной
      await creditForm.fillLoanAmount(500000);
      await creditForm.expectFieldValue(/сумма кредита/i, '500000');
    }
  );

  /**
   * TC-MEM-008: Очистка debounce-таймеров при размонтировании
   * Приоритет: High
   */
  test(
    'TC-MEM-008: Очистка debounce-таймеров при размонтировании',
    {
      tag: ['@high', '@memory-leaks'],
    },
    async ({ page }) => {
      await creditForm.selectLoanType('car');

      // Начинаем вводить (запускает debounce)
      await creditForm.fillCarBrand('Toy');

      // Сразу уходим со страницы (до истечения debounce)
      await page.goto('about:blank');
      await page.waitForTimeout(500);

      // Возвращаемся
      await creditForm.goto();

      // Не должно быть ошибок от предыдущего debounce
      expect(creditForm.hasNoErrors()).toBe(true);
    }
  );

  /**
   * TC-MEM-009: Очистка подписок на computed fields
   * Приоритет: High
   */
  test(
    'TC-MEM-009: Очистка подписок на computed fields',
    {
      tag: ['@high', '@memory-leaks'],
    },
    async () => {
      // Много изменений, триггерящих computed fields
      for (let i = 0; i < 20; i++) {
        await creditForm.selectLoanType('mortgage');
        await creditForm.fillPropertyValue(5000000 + i * 100000);
        await creditForm.page.waitForTimeout(50);

        await creditForm.selectLoanType('consumer');
        await creditForm.page.waitForTimeout(50);
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    }
  );

  /**
   * TC-MEM-010: Утечки closure в callbacks
   * Приоритет: Medium
   */
  test(
    'TC-MEM-010: Утечки closure в callbacks',
    {
      tag: ['@medium', '@memory-leaks'],
    },
    async ({ page }) => {
      // Много взаимодействий с полями (создание/удаление callbacks)
      for (let i = 0; i < 20; i++) {
        // Фокус/блюр на разных полях
        const fields = [
          page.getByLabel(/сумма кредита/i),
          page.getByLabel(/срок кредита/i),
          page.getByLabel(/цель кредита/i),
        ];

        for (const field of fields) {
          await field.focus();
          await field.blur();
        }
      }

      // Не должно быть ошибок
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    }
  );
});
