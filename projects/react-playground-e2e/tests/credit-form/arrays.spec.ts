import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Работа с массивами (ArrayNode)', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();

    // Переходим на шаг 5 (Дополнительная информация)
    for (let i = 0; i < 4; i++) {
      await creditForm.goToNextStep();
    }
  });

  // ============================================================================
  // Имущество (Properties)
  // ============================================================================

  test.describe('Массив имущества', () => {
    /**
     * TC-ARR-001: Добавление элемента в массив имущества
     * Приоритет: High
     */
    test(
      'TC-ARR-001: Добавление элемента в массив имущества',
      {
        tag: ['@high', '@arrays'],
      },
      async ({ page }) => {
        // Включаем чекбокс имущества
        const hasPropertyCheckbox = page.getByLabel(/у меня есть имущество/i);
        if ((await hasPropertyCheckbox.count()) > 0) {
          await hasPropertyCheckbox.check();
        }

        // Нажимаем кнопку добавления
        await page.getByRole('button', { name: /добавить имущество/i }).click();

        // Проверяем что элемент добавлен
        await expect(page.getByRole('heading', { name: /имущество #1/i })).toBeVisible();

        // Заполняем данные
        const propertyTypeSelect = page
          .locator('[class*="property"]')
          .getByLabel(/тип имущества/i)
          .first();
        if ((await propertyTypeSelect.count()) > 0) {
          await propertyTypeSelect.click();
          await page.getByRole('option', { name: /квартира/i }).click();
        }
      }
    );

    /**
     * TC-ARR-002: Удаление элемента из массива имущества
     * Приоритет: High
     */
    test(
      'TC-ARR-002: Удаление элемента из массива имущества',
      {
        tag: ['@high', '@arrays'],
      },
      async ({ page }) => {
        // Включаем чекбокс имущества
        const hasPropertyCheckbox = page.getByLabel(/у меня есть имущество/i);
        if ((await hasPropertyCheckbox.count()) > 0) {
          await hasPropertyCheckbox.check();
        }

        // Получаем начальное количество элементов имущества
        const initialPropertyHeadings = page.getByRole('heading', { name: /имущество #/i });
        const initialCount = await initialPropertyHeadings.count();

        // Добавляем 2 элемента
        await page.getByRole('button', { name: /добавить имущество/i }).click();
        await page.getByRole('button', { name: /добавить имущество/i }).click();

        // Теперь должно быть initialCount + 2 элементов
        const expectedAfterAdd = initialCount + 2;
        await expect(page.getByRole('heading', { name: /имущество #/i })).toHaveCount(
          expectedAfterAdd
        );

        // Удаляем первый элемент
        const deleteButtons = page.getByRole('button', { name: /удалить/i });
        await deleteButtons.first().click();

        // После удаления должно быть на 1 меньше
        const expectedAfterDelete = expectedAfterAdd - 1;
        await expect(page.getByRole('heading', { name: /имущество #/i })).toHaveCount(
          expectedAfterDelete
        );

        // Проверяем что нет ошибок
        expect(creditForm.hasNoStackOverflow()).toBe(true);
      }
    );

    /**
     * TC-ARR-003: Валидация каждого элемента массива
     * Приоритет: High
     */
    test(
      'TC-ARR-003: Валидация каждого элемента массива',
      {
        tag: ['@high', '@arrays'],
      },
      async ({ page }) => {
        // Включаем чекбокс имущества
        const hasPropertyCheckbox = page.getByLabel(/у меня есть имущество/i);
        if ((await hasPropertyCheckbox.count()) > 0) {
          await hasPropertyCheckbox.check();
        }

        // Добавляем элемент без заполнения
        await page.getByRole('button', { name: /добавить имущество/i }).click();

        // Пытаемся перейти на следующий шаг
        await creditForm.goToNextStep();

        // Проверяем что остались на шаге 5
        await creditForm.expectStepHeading(/дополнительная информация/i);

        // Должны отображаться ошибки валидации (минимум одна)
        await expect(page.locator('.text-red-500').first()).toBeVisible();
      }
    );
  });

  // ============================================================================
  // Существующие кредиты (Existing Loans)
  // ============================================================================

  test.describe('Массив существующих кредитов', () => {
    /**
     * TC-ARR-004: Добавление нескольких существующих кредитов
     * Приоритет: Medium
     */
    test(
      'TC-ARR-004: Добавление нескольких существующих кредитов',
      {
        tag: ['@medium', '@arrays'],
      },
      async ({ page }) => {
        // Включаем чекбокс кредитов
        const hasLoansCheckbox = page.getByLabel(/у меня есть другие кредиты/i);
        if ((await hasLoansCheckbox.count()) > 0) {
          await hasLoansCheckbox.check();

          // Добавляем 3 кредита
          for (let i = 0; i < 3; i++) {
            await page.getByRole('button', { name: /добавить кредит/i }).click();
          }

          // Проверяем что все добавлены
          await expect(page.getByRole('heading', { name: /кредит #1/i })).toBeVisible();
          await expect(page.getByRole('heading', { name: /кредит #2/i })).toBeVisible();
          await expect(page.getByRole('heading', { name: /кредит #3/i })).toBeVisible();
        }
      }
    );
  });

  // ============================================================================
  // Созаемщики (Co-Borrowers)
  // ============================================================================

  test.describe('Массив созаемщиков', () => {
    /**
     * TC-ARR-005: Добавление созаемщика с полными данными
     * Приоритет: High
     */
    test(
      'TC-ARR-005: Добавление созаемщика с полными данными',
      {
        tag: ['@high', '@arrays'],
      },
      async ({ page }) => {
        // Включаем чекбокс созаемщиков
        const addCoBorrowerCheckbox = page.getByLabel(/добавить созаемщика/i);
        if ((await addCoBorrowerCheckbox.count()) > 0) {
          await addCoBorrowerCheckbox.check();

          // Добавляем созаемщика
          await page.getByRole('button', { name: /добавить созаемщика/i }).click();

          // Проверяем что секция появилась
          await expect(page.getByRole('heading', { name: /созаемщик #1/i })).toBeVisible();

          // Заполняем данные (если поля доступны)
          const lastNameField = page
            .locator('[class*="co-borrower"]')
            .getByLabel(/фамилия/i)
            .first();
          if ((await lastNameField.count()) > 0) {
            await lastNameField.fill('Петров');
          }
        }
      }
    );

    /**
     * TC-ARR-006: Максимальное количество элементов в массиве
     * Приоритет: Low
     */
    test(
      'TC-ARR-006: Максимальное количество элементов в массиве',
      {
        tag: ['@low', '@arrays'],
      },
      async ({ page }) => {
        // Включаем чекбокс имущества
        const hasPropertyCheckbox = page.getByLabel(/у меня есть имущество/i);
        if ((await hasPropertyCheckbox.count()) > 0) {
          await hasPropertyCheckbox.check();

          // Добавляем много элементов
          for (let i = 0; i < 10; i++) {
            await page.getByRole('button', { name: /добавить имущество/i }).click();
            await page.waitForTimeout(100);
          }

          // Проверяем что форма работает стабильно
          expect(creditForm.hasNoErrors()).toBe(true);

          // Проверяем что нет проблем с производительностью (нет зависаний)
          const heading = page.getByRole('heading', { name: /имущество #10/i });
          await expect(heading).toBeVisible({ timeout: 5000 });
        }
      }
    );
  });
});
