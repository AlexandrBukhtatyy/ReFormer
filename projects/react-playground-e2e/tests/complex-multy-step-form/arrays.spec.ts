/**
 * Arrays E2E Tests
 *
 * Тесты работы с массивами форм (ArrayNode):
 * - Добавление элементов
 * - Удаление элементов
 * - Валидация элементов
 * - Лимиты массивов
 */

import { test, expect } from '../shared/test-factory';

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

      // Добавляем 3 созаемщиков
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();

      // Проверяем, что все 3 формы появились
      await expect(creditForm.page.locator('text=/созаемщик.*#1/i')).toBeVisible();
      await expect(creditForm.page.locator('text=/созаемщик.*#2/i')).toBeVisible();
      await expect(creditForm.page.locator('text=/созаемщик.*#3/i')).toBeVisible();

      // Проверяем количество форм
      const coBorrowerForms = creditForm.page.locator('[data-testid*="coBorrower-lastName"]');
      await expect(coBorrowerForms).toHaveCount(3);
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

      // Удаляем созаемщика
      await creditForm.page.getByRole('button', { name: /удалить/i }).first().click();

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
      const deleteButtons = creditForm.page.getByRole('button', { name: /удалить/i });
      await deleteButtons.nth(1).click();

      // Проверяем, что остались первый и третий
      await expect(creditForm.input('coBorrower-lastName').first()).toHaveValue('Первый');
      await expect(creditForm.input('coBorrower-lastName').nth(1)).toHaveValue('Третий');
      await expect(creditForm.input('coBorrower-lastName')).toHaveCount(2);
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
      await creditForm.page.getByRole('button', { name: /удалить/i }).first().click();

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

      await creditForm.page.getByRole('button', { name: /удалить/i }).first().click();
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

      // Пытаемся перейти дальше
      await creditForm.goToNextStep();

      // Должны остаться на шаге 5 с ошибками
      await creditForm.expectStepHeading(/дополнительная информация/i);

      // Проверяем ошибки валидации
      await creditForm.expectFieldError('coBorrower-lastName');
      await creditForm.expectFieldError('coBorrower-firstName');
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

      // Заполняем с невалидным телефоном
      await creditForm.input('coBorrower-lastName').first().fill('Тестов');
      await creditForm.input('coBorrower-firstName').first().fill('Тест');
      await creditForm.input('coBorrower-phone').first().fill('+7 (123)');
      await creditForm.input('coBorrower-phone').first().blur();

      await creditForm.expectFieldError('coBorrower-phone');
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

      await creditForm.input('coBorrower-email').first().fill('invalid-email');
      await creditForm.input('coBorrower-email').first().blur();

      await creditForm.expectFieldError('coBorrower-email');
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

      // Добавляем 5 созаемщиков
      for (let i = 0; i < 5; i++) {
        await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      }

      // Все 5 должны быть добавлены
      const coBorrowerForms = creditForm.page.locator('[data-testid*="coBorrower-lastName"]');
      await expect(coBorrowerForms).toHaveCount(5);
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

      // Проверяем empty state
      await expect(
        creditForm.page.locator('text=/нажмите.*добавить.*имущество/i')
      ).toBeVisible();

      // После добавления элемента empty state исчезает
      await creditForm.page.getByRole('button', { name: /добавить имущество/i }).click();
      await expect(
        creditForm.page.locator('text=/нажмите.*добавить.*имущество/i')
      ).not.toBeVisible();

      // После удаления элемента empty state появляется снова
      await creditForm.page.getByRole('button', { name: /удалить/i }).first().click();
      await expect(
        creditForm.page.locator('text=/нажмите.*добавить.*имущество/i')
      ).toBeVisible();
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
