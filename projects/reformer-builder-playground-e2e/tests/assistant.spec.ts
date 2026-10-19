import { test, expect } from './shared/fixtures';

/**
 * Ассистент: настройки канала. Модель для этих тестов не нужна — список моделей локального
 * сервера отдаёт подмена запроса, поэтому тест не зависит от того, запущен ли Ollama.
 */
test.describe('Ассистент', () => {
  test('режим правки выбирается в настройках канала и переживает переподключение', async ({
    builder,
    page,
  }) => {
    test.setTimeout(120_000);
    await page.route('**/localhost:11434/v1/models', (route) =>
      route.fulfill({ json: { data: [{ id: 'e2e-model' }] } })
    );
    await builder.openPlayground({ plugins: ['reformer/ai'] });

    // Плагины проекта поднимаются отдельной цепочкой после открытия — вкладка ассистента
    // появляется на рейле не сразу.
    const rail = page.getByRole('navigation', { name: 'Панели справа' });
    await expect(rail.getByRole('button', { name: 'Ассистент' })).toBeVisible({ timeout: 60_000 });
    await rail.getByRole('button', { name: 'Ассистент' }).click();
    await page.getByRole('button', { name: 'Настройки канала' }).click();

    await page.getByRole('combobox', { name: 'Провайдер' }).click();
    await page.getByRole('option', { name: 'Локальный (OpenAI-совместимый)' }).click();
    await page.getByRole('button', { name: 'Загрузить список моделей' }).click();
    await expect(page.getByRole('combobox', { name: 'Модель' })).toHaveText('e2e-model');

    // По умолчанию — прежний режим: настройки без поля режима читаются как structured.
    const mode = page.getByRole('combobox', { name: 'Как ассистент правит форму' });
    await expect(mode).toHaveText('Операциями редактора');
    await mode.click();
    await page.getByRole('option', { name: 'Напрямую в файлах формы' }).click();
    await expect(
      page.getByText(/В режиме файлов модель сама правит файлы модуля формы/)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Подключить' }).click();
    // Подключение закрывает настройки; открытые снова, они показывают сохранённый режим.
    await expect(mode).toBeHidden();
    await page.getByRole('button', { name: 'Настройки канала' }).click();
    await expect(page.getByRole('combobox', { name: 'Как ассистент правит форму' })).toHaveText(
      'Напрямую в файлах формы'
    );
  });
});
