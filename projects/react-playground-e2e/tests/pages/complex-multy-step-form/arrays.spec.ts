/**
 * Arrays E2E Tests
 *
 * Тесты работы с массивами форм (ArrayNode):
 * - Добавление элементов
 * - Удаление элементов
 * - Валидация элементов
 * - Лимиты массивов
 */

import { test, expect } from '../../shared/test-factory';

test.describe('Arrays', { tag: ['@arrays'] }, () => {
  test.describe('ARR-001: Добавление созаемщика', () => {
    test('ARR-001-A: Добавление одного созаемщика', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      // Включаем созаемщиков
      await creditForm.toggleAddCoBorrower(true);

      // Добавляем созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Проверяем, что форма созаемщика появилась
      await expect(creditForm.page.locator('text=/созаемщик.*#1/i')).toBeVisible();
      await expect(creditForm.input('coBorrower-lastName').first()).toBeVisible();
      await expect(creditForm.input('coBorrower-firstName').first()).toBeVisible();
      await expect(creditForm.input('coBorrower-phone').first()).toBeVisible();
      await expect(creditForm.input('coBorrower-email').first()).toBeVisible();
      await expect(creditForm.input('coBorrower-monthlyIncome').first()).toBeVisible();
    });

    test('ARR-001-B: Добавление нескольких созаемщиков', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      // FormArray starts with 1 initial item from schema definition [coBorrowersFormSchema]
      // Get initial count of coBorrower forms
      const coBorrowerForms = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
      const initialCount = await coBorrowerForms.count();

      // Добавляем 3 созаемщиков
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // After adding 3, total should be initialCount + 3
      await expect(coBorrowerForms).toHaveCount(initialCount + 3);

      // Проверяем, что формы появились (at least 3 visible)
      await expect(creditForm.page.locator('text=/созаемщик.*#1/i')).toBeVisible();
      await expect(creditForm.page.locator('text=/созаемщик.*#2/i')).toBeVisible();
      await expect(creditForm.page.locator('text=/созаемщик.*#3/i')).toBeVisible();
    });

    test('ARR-001-C: Данные созаемщика сохраняются при навигации', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Заполняем данные созаемщика
      await creditForm.input('coBorrower-lastName').first().fill('Сидорова');
      await creditForm.input('coBorrower-firstName').first().fill('Мария');
      await creditForm.input('coBorrower-middleName').first().fill('Александровна');
      await creditForm.input('coBorrower-monthlyIncome').first().fill('75000');

      // Переходим назад и вперед
      await creditForm.goToPreviousStep();
      await creditForm.goToNextStep();

      // Проверяем сохранение данных
      await expect(creditForm.input('coBorrower-lastName').first()).toHaveValue('Сидорова');
      await expect(creditForm.input('coBorrower-firstName').first()).toHaveValue('Мария');
      await expect(creditForm.input('coBorrower-monthlyIncome').first()).toHaveValue('75000');
    });
  });

  test.describe('ARR-002: Удаление элементов массива', () => {
    test('ARR-002-A: Удаление единственного созаемщика', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Проверяем, что созаемщик добавлен
      await expect(creditForm.page.locator('text=/созаемщик.*#1/i')).toBeVisible();

      // Удаляем созаемщика (используем локатор внутри секции созаемщиков)
      const coBorrowerSection = creditForm.page.locator('[data-testid="step-additional-info"]');
      await coBorrowerSection.getByRole('button', { name: /удалить/i }).first().click();
      await creditForm.page.waitForTimeout(300); // Ждём обновления DOM

      // Созаемщик удален, появляется empty state
      await expect(creditForm.page.locator('text=/созаемщик.*#1/i')).not.toBeVisible();
    });

    test('ARR-002-B: Удаление одного из нескольких созаемщиков', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      // Добавляем 3 созаемщиков с уникальными данными
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.input('coBorrower-lastName').first().fill('Первый');

      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.input('coBorrower-lastName').nth(1).fill('Второй');

      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.input('coBorrower-lastName').nth(2).fill('Третий');

      // Удаляем второго (индекс 1)
      const coBorrowerSection = creditForm.page.locator('[data-testid="step-additional-info"]');
      const deleteButtons = coBorrowerSection.getByRole('button', { name: /удалить/i });
      await deleteButtons.nth(1).click();
      await creditForm.page.waitForTimeout(300);

      // Проверяем, что остались первый и третий (используем visible)
      const visibleInputs = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]:visible');
      await expect(visibleInputs.first()).toHaveValue('Первый');
      await expect(visibleInputs.nth(1)).toHaveValue('Третий');
      await expect(visibleInputs).toHaveCount(2);
    });

    test('ARR-002-C: Удаление имущества', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleHasProperty(true);

      // Добавляем 2 объекта имущества
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();

      await expect(creditForm.page.locator('text=/имущество.*#1/i')).toBeVisible();
      await expect(creditForm.page.locator('text=/имущество.*#2/i')).toBeVisible();

      // Удаляем первый
      const section = creditForm.page.locator('[data-testid="step-additional-info"]');
      await section.getByRole('button', { name: /удалить/i }).first().click();
      await creditForm.page.waitForTimeout(300);

      // Должен остаться один (нумерация обновится)
      await expect(creditForm.page.locator('text=/имущество.*#1/i')).toBeVisible();
      await expect(creditForm.page.locator('text=/имущество.*#2/i')).not.toBeVisible();
    });

    test('ARR-002-D: Удаление кредита', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleHasLoans(true);

      await creditForm.page.getByRole('button', { name: /добавить кредит/i }).click();
      await expect(creditForm.page.locator('text=/кредит.*#1/i')).toBeVisible();

      const section = creditForm.page.locator('[data-testid="step-additional-info"]');
      await section.getByRole('button', { name: /удалить/i }).first().click();
      await creditForm.page.waitForTimeout(300);

      await expect(creditForm.page.locator('text=/кредит.*#1/i')).not.toBeVisible();
    });
  });

  test.describe('ARR-003: Валидация элементов массива', () => {
    test('ARR-003-A: Валидация обязательных полей созаемщика', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.selectMaritalStatus('married');
      await creditForm.fillDependents(0);
      await creditForm.selectEducation('higher');
      await creditForm.toggleHasProperty(false);
      await creditForm.toggleHasLoans(false);
      await creditForm.toggleAddCoBorrower(true);

      // Добавляем пустого созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Пытаемся перейти дальше - это должно вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 5 (переход заблокирован)
      await creditForm.expectStepHeading(/дополнительная информация/i);
    });

    test('ARR-003-B: Валидация формата телефона созаемщика', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.selectMaritalStatus('married');
      await creditForm.fillDependents(0);
      await creditForm.selectEducation('higher');
      await creditForm.toggleHasProperty(false);
      await creditForm.toggleHasLoans(false);
      await creditForm.toggleAddCoBorrower(true);

      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Заполняем обязательные поля, но с невалидным телефоном
      await creditForm.input('coBorrower-lastName').first().fill('Тестов');
      await creditForm.input('coBorrower-firstName').first().fill('Тест');
      await creditForm.input('coBorrower-middleName').first().fill('Тестович');
      await creditForm.input('coBorrower-birthDate').first().fill('1990-01-01');
      await creditForm.input('coBorrower-phone').first().fill('+7 (123)'); // Невалидный телефон
      await creditForm.input('coBorrower-email').first().fill('test@example.com');
      await creditForm.input('coBorrower-monthlyIncome').first().fill('50000');

      // Попытка перехода должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 5 (переход заблокирован из-за невалидного телефона)
      await creditForm.expectStepHeading(/дополнительная информация/i);
    });

    test('ARR-003-C: Валидация email созаемщика', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.selectMaritalStatus('married');
      await creditForm.fillDependents(0);
      await creditForm.selectEducation('higher');
      await creditForm.toggleHasProperty(false);
      await creditForm.toggleHasLoans(false);
      await creditForm.toggleAddCoBorrower(true);

      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Заполняем обязательные поля, но с невалидным email
      await creditForm.input('coBorrower-lastName').first().fill('Тестов');
      await creditForm.input('coBorrower-firstName').first().fill('Тест');
      await creditForm.input('coBorrower-middleName').first().fill('Тестович');
      await creditForm.input('coBorrower-birthDate').first().fill('1990-01-01');
      await creditForm.input('coBorrower-phone').first().fill('+7 (999) 123-45-67');
      await creditForm.input('coBorrower-email').first().fill('invalid-email'); // Невалидный email
      await creditForm.input('coBorrower-monthlyIncome').first().fill('50000');

      // Попытка перехода должна вызвать валидацию
      await creditForm.goToNextStep();

      // Должны остаться на шаге 5 (переход заблокирован из-за невалидного email)
      await creditForm.expectStepHeading(/дополнительная информация/i);
    });

    test('ARR-003-D: Успешная валидация полностью заполненного созаемщика', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.selectMaritalStatus('married');
      await creditForm.fillDependents(0);
      await creditForm.selectEducation('higher');
      await creditForm.toggleHasProperty(false);
      await creditForm.toggleHasLoans(false);
      await creditForm.toggleAddCoBorrower(true);

      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Заполняем все поля корректно
      await creditForm.input('coBorrower-lastName').first().fill('Сидорова');
      await creditForm.input('coBorrower-firstName').first().fill('Анна');
      await creditForm.input('coBorrower-middleName').first().fill('Петровна');
      await creditForm.input('coBorrower-birthDate').first().fill('1990-05-15');
      await creditForm.input('coBorrower-phone').first().fill('+7 (999) 888-77-66');
      await creditForm.input('coBorrower-email').first().fill('anna@example.com');
      await creditForm.input('coBorrower-monthlyIncome').first().fill('80000');

      // Переход должен быть успешным
      await creditForm.goToNextStep();
      await creditForm.expectStepHeading(/подтверждение/i);
    });
  });

  test.describe('ARR-004: Лимиты массивов', () => {
    test('ARR-004-A: Проверка отсутствия явного лимита созаемщиков', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      // FormArray starts with initial item(s)
      const coBorrowerForms = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
      const initialCount = await coBorrowerForms.count();

      // Добавляем 5 созаемщиков
      for (let i = 0; i < 5; i++) {
        await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      }

      // Все 5 должны быть добавлены (initial + 5)
      await expect(coBorrowerForms).toHaveCount(initialCount + 5);
    });

    test('ARR-004-B: Кнопка "Добавить" всегда доступна', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleHasProperty(true);

      // Добавляем несколько объектов
      for (let i = 0; i < 3; i++) {
        await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();
      }

      // Кнопка все еще доступна
      await expect(
        creditForm.page.getByRole('button', { name: /добавить имущество/i })
      ).toBeEnabled();
    });

    test('ARR-004-C: Пустое состояние массива (empty state)', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleHasProperty(true);

      // FormArray starts with initial item from schema, so empty state may not be visible initially
      // Check if we have items first
      const propertyForms = creditForm.page.locator('[data-testid="step-additional-info"]').locator('text=/имущество.*#/i');
      const initialCount = await propertyForms.count();

      if (initialCount > 0) {
        // Remove all initial items to see empty state
        while ((await propertyForms.count()) > 0) {
          const section = creditForm.page.locator('[data-testid="step-additional-info"]');
          await section.getByRole('button', { name: /удалить/i }).first().click();
          await creditForm.page.waitForTimeout(300);
        }
      }

      // Now empty state should be visible
      const emptyStateText = creditForm.page.getByText(/для добавления информации/i);
      await expect(emptyStateText.first()).toBeVisible();

      // После добавления элемента empty state исчезает
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();
      await creditForm.page.waitForTimeout(300);
      await expect(creditForm.page.locator('text=/имущество.*#1/i')).toBeVisible();
      await expect(emptyStateText.first()).not.toBeVisible();
    });
  });

  test.describe('ARR-005: Вложенные группы в массивах', () => {
    test('ARR-005-A: Созаемщик с вложенной группой personalData', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Проверяем, что вложенные поля personalData доступны
      // В CoBorrowerForm поля personalData имеют структуру coBorrower-lastName и т.д.
      await expect(creditForm.input('coBorrower-lastName').first()).toBeVisible();
      await expect(creditForm.input('coBorrower-firstName').first()).toBeVisible();
      await expect(creditForm.input('coBorrower-middleName').first()).toBeVisible();
      await expect(creditForm.input('coBorrower-birthDate').first()).toBeVisible();

      // Заполняем вложенные поля
      await creditForm.input('coBorrower-lastName').first().fill('Вложенный');
      await creditForm.input('coBorrower-firstName').first().fill('Тест');
      await creditForm.input('coBorrower-middleName').first().fill('Тестович');

      // Проверяем сохранение
      await expect(creditForm.input('coBorrower-lastName').first()).toHaveValue('Вложенный');
    });
  });
});
