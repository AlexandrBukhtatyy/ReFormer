import { test, expect } from '@playwright/test';

test.describe('FormArrayManager - Remove item bug', () => {
  test('should not crash when removing non-last item from array', async ({ page }) => {
    // Отслеживаем ошибки в консоли
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Отслеживаем uncaught exceptions
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // 1. Открыть страницу
    await page.goto('/');

    // 2. Дождаться загрузки формы
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Дать время на загрузку данных

    // 3. Нажать кнопку "Далее" 4 раза чтобы дойти до шага 5
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: /далее/i }).click();
      await page.waitForTimeout(500); // Даём время на переход между шагами
    }

    // 4. Проверяем что мы на 5-м шаге (Additional Info)
    await expect(page.getByRole('heading', { name: 'Дополнительная информация' })).toBeVisible();

    // 5. Проверяем что есть секция "Имущество"
    await expect(page.getByRole('heading', { name: 'Имущество', exact: true })).toBeVisible();

    // 6. Проверяем что есть хотя бы 2 элемента имущества
    const property1 = page.getByRole('heading', { name: 'Имущество #1' });
    const property2 = page.getByRole('heading', { name: 'Имущество #2' });

    // Проверяем что есть хотя бы 2 элемента (они загружаются из данных)
    await expect(property1).toBeVisible();
    await expect(property2).toBeVisible();

    console.log('Found properties #1 and #2');

    // 7. Удалить первый элемент (не последний) - находим кнопку удаления рядом с "Имущество #1"
    const deleteButtons = page.getByRole('button', { name: /удалить/i });
    const firstDeleteButton = deleteButtons.first();
    await firstDeleteButton.click();

    // 8. Даём время на обработку удаления
    await page.waitForTimeout(1000);

    // 9. Проверяем что нет ошибок "Maximum call stack size exceeded"
    const hasStackOverflow = pageErrors.some((error) =>
      error.includes('Maximum call stack size exceeded')
    );

    console.log('Console errors:', consoleErrors);
    console.log('Page errors:', pageErrors);

    // Тест должен провалиться если есть ошибка переполнения стека
    expect(hasStackOverflow).toBe(false);
  });
});
