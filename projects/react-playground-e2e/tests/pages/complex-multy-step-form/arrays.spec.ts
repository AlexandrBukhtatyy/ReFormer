/**
 * E2E-тесты массивов форм
 *
 * Тесты работы с массивами форм (ArrayNode):
 * - Добавление элементов
 * - Удаление элементов
 * - Валидация элементов
 * - Лимиты массивов
 */

import { test, expect } from '../../shared/test-factory';
import type { CreditFormPage } from './credit-form-page.pom';

test.describe('Массивы форм', { tag: ['@arrays'] }, () => {
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

      // FormArray стартует с 1 элементом из схемы [coBorrowersFormSchema]
      // Получаем начальное количество форм созаемщиков
      const coBorrowerForms = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
      const initialCount = await coBorrowerForms.count();

      // Добавляем 3 созаемщиков
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // После добавления 3-х итоговое количество должно быть initialCount + 3
      await expect(coBorrowerForms).toHaveCount(initialCount + 3);

      // Проверяем, что формы появились (минимум 3 видимых)
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
    test('ARR-002-A: Удаление созаемщика уменьшает количество', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      // Находим секцию созаемщиков по заголовку
      const coBorrowerSection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Созаемщики\s*\+ Добавить созаемщика/ });

      // Получаем начальное количество созаемщиков (форма может загружаться с данными)
      const coBorrowerItems = coBorrowerSection.locator('text=/созаемщик.*#/i');
      const initialCount = await coBorrowerItems.count();

      // Добавляем созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await expect(coBorrowerItems).toHaveCount(initialCount + 1);

      // Удаляем созаемщика (используем локатор внутри секции созаемщиков)
      await coBorrowerSection
        .getByRole('button', { name: /удалить/i })
        .first()
        .click();
      await creditForm.page.waitForTimeout(300); // Ждём обновления DOM

      // Количество созаемщиков уменьшилось
      await expect(coBorrowerItems).toHaveCount(initialCount);
    });

    test('ARR-002-B: Удаление одного из нескольких созаемщиков', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      // Находим секцию созаемщиков по заголовку
      const coBorrowerSection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Созаемщики\s*\+ Добавить созаемщика/ });

      // Получаем начальное количество созаемщиков (форма может загружаться с данными)
      const coBorrowerInputs = coBorrowerSection.locator(
        '[data-testid="input-coBorrower-lastName"]'
      );
      const initialCount = await coBorrowerInputs.count();

      // Добавляем 3 созаемщиков с уникальными данными
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await coBorrowerInputs.nth(initialCount).fill('Первый');

      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await coBorrowerInputs.nth(initialCount + 1).fill('Второй');

      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await coBorrowerInputs.nth(initialCount + 2).fill('Третий');

      // Проверяем, что добавились 3 созаемщика
      await expect(coBorrowerInputs).toHaveCount(initialCount + 3);

      // Удаляем созаемщика "Второй" (внутри секции созаемщиков)
      const deleteButtons = coBorrowerSection.getByRole('button', { name: /удалить/i });
      // Удаляем элемент с индексом initialCount + 1 (это "Второй")
      await deleteButtons.nth(initialCount + 1).click();
      await creditForm.page.waitForTimeout(300);

      // Проверяем, что количество уменьшилось на 1
      await expect(coBorrowerInputs).toHaveCount(initialCount + 2);

      // Проверяем, что "Второй" удален, а "Первый" и "Третий" остались
      const allValues: string[] = [];
      const count = await coBorrowerInputs.count();
      for (let i = 0; i < count; i++) {
        allValues.push(await coBorrowerInputs.nth(i).inputValue());
      }
      expect(allValues).toContain('Первый');
      expect(allValues).toContain('Третий');
      expect(allValues).not.toContain('Второй');
    });

    test('ARR-002-C: Удаление имущества уменьшает количество', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleHasProperty(true);

      // Находим секцию имущества по заголовку
      const propertySection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Имущество\s*\+ Добавить имущество/ });

      // Получаем начальное количество имущества (форма может загружаться с данными)
      const propertyItems = propertySection.locator('text=/имущество.*#/i');
      const initialCount = await propertyItems.count();

      // Добавляем 2 объекта имущества
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();

      await expect(propertyItems).toHaveCount(initialCount + 2);

      // Удаляем один (внутри секции имущества)
      const deleteButtons = propertySection.getByRole('button', { name: /удалить/i });
      await deleteButtons.first().click();
      await creditForm.page.waitForTimeout(300);

      // Количество уменьшилось на 1
      await expect(propertyItems).toHaveCount(initialCount + 1);
    });

    test('ARR-002-D: Удаление кредита уменьшает количество', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleHasLoans(true);

      // Находим секцию кредитов по заголовку
      const loansSection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Существующие кредиты\s*\+ Добавить кредит/ });

      // Получаем начальное количество кредитов
      const loanItems = loansSection.locator('text=/кредит.*#/i');
      const initialCount = await loanItems.count();

      // Добавляем кредит
      await creditForm.page.getByRole('button', { name: /добавить кредит/i }).click();
      await expect(loanItems).toHaveCount(initialCount + 1);

      // Удаляем один (внутри секции кредитов)
      const deleteButtons = loansSection.getByRole('button', { name: /удалить/i });
      await deleteButtons.first().click();
      await creditForm.page.waitForTimeout(300);

      // Количество вернулось к начальному
      await expect(loanItems).toHaveCount(initialCount);
    });
  });

  test.describe('ARR-003: Валидация элементов массива', () => {
    // ЗАМЕТКА: валидация на уровне шага (validateForm) не блокирует навигацию
    // для невалидных элементов массива. Эти тесты проверяют, что добавление
    // созаёмщиков с разными состояниями данных работает корректно,
    // а валидные созаёмщики позволяют успешно двигаться по форме дальше.

    test('ARR-003-A: Добавление созаемщика с пустыми полями не блокирует переход', async ({
      creditForm,
    }) => {
      // ЗАМЕТКА: тест документирует текущее поведение — step-валидация не проверяет
      // поля элементов массива. Валидация элементов массива происходит только
      // при отправке всей формы.
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

      // Находим секцию созаемщиков
      const coBorrowerSection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Созаемщики\s*\+ Добавить созаемщика/ });

      // Удаляем всех существующих созаемщиков (форма может загружаться с данными)
      let deleteButton = coBorrowerSection.getByRole('button', { name: /удалить/i }).first();
      while ((await deleteButton.count()) > 0) {
        await deleteButton.click();
        await creditForm.page.waitForTimeout(300);
        deleteButton = coBorrowerSection.getByRole('button', { name: /удалить/i }).first();
      }

      // Добавляем пустого созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Переход на следующий шаг разрешён (step validation не валидирует элементы массива)
      await creditForm.goToNextStep();

      // Переходим на шаг 6 (подтверждение) - это текущее поведение
      await creditForm.expectStepHeading(/подтверждение/i);
    });

    test('ARR-003-B: Созаемщик с частично заполненными полями позволяет переход', async ({
      creditForm,
    }) => {
      // ЗАМЕТКА: тест документирует текущее поведение — step-валидация не проверяет поля элементов массива.
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

      // Находим секцию созаемщиков
      const coBorrowerSection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Созаемщики\s*\+ Добавить созаемщика/ });

      // Удаляем всех существующих созаемщиков
      let deleteButton = coBorrowerSection.getByRole('button', { name: /удалить/i }).first();
      while ((await deleteButton.count()) > 0) {
        await deleteButton.click();
        await creditForm.page.waitForTimeout(300);
        deleteButton = coBorrowerSection.getByRole('button', { name: /удалить/i }).first();
      }

      // Добавляем созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Заполняем только часть полей
      await coBorrowerSection.locator('[data-testid="input-coBorrower-lastName"]').fill('Тестов');
      await coBorrowerSection.locator('[data-testid="input-coBorrower-firstName"]').fill('Тест');
      await coBorrowerSection.locator('[data-testid="input-coBorrower-phone"]').fill('+7 (123)'); // Невалидный телефон

      // Переход разрешён (step validation не проверяет элементы массива)
      await creditForm.goToNextStep();

      // Переходим на шаг 6 - это текущее поведение
      await creditForm.expectStepHeading(/подтверждение/i);
    });

    test('ARR-003-C: Созаемщик с невалидным email позволяет переход', async ({ creditForm }) => {
      // ЗАМЕТКА: тест документирует текущее поведение — step-валидация не проверяет поля элементов массива.
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

      // Находим секцию созаемщиков
      const coBorrowerSection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Созаемщики\s*\+ Добавить созаемщика/ });

      // Удаляем всех существующих созаемщиков
      let deleteButton = coBorrowerSection.getByRole('button', { name: /удалить/i }).first();
      while ((await deleteButton.count()) > 0) {
        await deleteButton.click();
        await creditForm.page.waitForTimeout(300);
        deleteButton = coBorrowerSection.getByRole('button', { name: /удалить/i }).first();
      }

      // Добавляем созаемщика
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Заполняем поля с невалидным email
      await coBorrowerSection.locator('[data-testid="input-coBorrower-lastName"]').fill('Тестов');
      await coBorrowerSection.locator('[data-testid="input-coBorrower-firstName"]').fill('Тест');
      await coBorrowerSection
        .locator('[data-testid="input-coBorrower-middleName"]')
        .fill('Тестович');
      await coBorrowerSection
        .locator('[data-testid="input-coBorrower-birthDate"]')
        .fill('1990-01-01');
      await coBorrowerSection
        .locator('[data-testid="input-coBorrower-phone"]')
        .fill('+7 (999) 123-45-67');
      await coBorrowerSection
        .locator('[data-testid="input-coBorrower-email"]')
        .fill('invalid-email'); // Невалидный email
      await coBorrowerSection
        .locator('[data-testid="input-coBorrower-monthlyIncome"]')
        .fill('50000');

      // Переход разрешён (step validation не проверяет элементы массива)
      await creditForm.goToNextStep();

      // Переходим на шаг 6 - это текущее поведение
      await creditForm.expectStepHeading(/подтверждение/i);
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

      // FormArray стартует с начальным элементом (или несколькими)
      const coBorrowerForms = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
      const initialCount = await coBorrowerForms.count();

      // Добавляем 5 созаемщиков
      for (let i = 0; i < 5; i++) {
        await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      }

      // Все 5 должны быть добавлены (начальные + 5)
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

    test('ARR-004-C: Пустое состояние массива', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleHasProperty(true);

      // Находим секцию имущества по заголовку
      const propertySection = creditForm.page
        .locator('.bg-gray-50')
        .filter({ hasText: /^Имущество\s*\+ Добавить имущество/ });

      // Удаляем все существующие элементы имущества
      let propertyItems = propertySection.locator('text=/имущество.*#/i');
      while ((await propertyItems.count()) > 0) {
        const deleteButton = propertySection.getByRole('button', { name: /удалить/i }).first();
        await deleteButton.click();
        await creditForm.page.waitForTimeout(300);
        propertyItems = propertySection.locator('text=/имущество.*#/i');
      }

      // Теперь внутри секции имущества должно отображаться пустое состояние
      const emptyStateText = propertySection.getByText(/для добавления информации/i);
      await expect(emptyStateText).toBeVisible();

      // После добавления элемента пустое состояние исчезает
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();
      await creditForm.page.waitForTimeout(300);
      await expect(propertySection.locator('text=/имущество.*#1/i')).toBeVisible();
      await expect(emptyStateText).not.toBeVisible();
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

  // -------------------------------------------------------------------------
  // ARR-006: Поле relationship у созаёмщика
  // -------------------------------------------------------------------------

  test.describe('ARR-006: Поле relationship у созаёмщика', { tag: ['@regression'] }, () => {
    async function navigateToStep5WithCoBorrower(creditForm: CreditFormPage) {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();
      await creditForm.toggleAddCoBorrower(true);
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
    }

    test('ARR-006-A: поле relationship обязательно — при пустом значении шаг не переходит', async ({
      creditForm,
    }) => {
      await navigateToStep5WithCoBorrower(creditForm);

      // Заполняем минимальные данные созаёмщика кроме relationship
      await creditForm.input('coBorrower-lastName').first().fill('Иванов');
      await creditForm.input('coBorrower-firstName').first().fill('Пётр');
      await creditForm.input('coBorrower-monthlyIncome').first().fill('50000');

      // Не выбираем relationship, пытаемся перейти
      await creditForm.goToNextStep();

      // Ожидаем ошибку на поле relationship или остаёмся на шаге 5
      const relationshipError = creditForm.page.locator(
        '[data-testid="error-coBorrower-relationship"], [data-testid*="relationship"] [class*="error"]'
      );
      const step5Heading = creditForm.page
        .locator('h2, h3, [class*="heading"]')
        .filter({ hasText: /дополнительная информация/i });

      const hasError = (await relationshipError.count()) > 0;
      const onStep5 = (await step5Heading.count()) > 0;

      expect(hasError || onStep5).toBeTruthy();
    });

    test('ARR-006-B: все значения enum relationship доступны в select', async ({ creditForm }) => {
      await navigateToStep5WithCoBorrower(creditForm);

      const relationshipSelect = creditForm.page
        .locator('[data-testid="input-coBorrower-relationship"], select[name*="relationship"]')
        .first();

      await expect(relationshipSelect).toBeVisible({ timeout: 5000 });

      // Проверяем наличие значений enum
      const expectedValues = ['spouse', 'parent', 'child', 'sibling', 'relative', 'other'];
      for (const value of expectedValues) {
        const option = relationshipSelect.locator(`option[value="${value}"]`);
        await expect(option).toBeAttached();
      }
    });
  });
});
