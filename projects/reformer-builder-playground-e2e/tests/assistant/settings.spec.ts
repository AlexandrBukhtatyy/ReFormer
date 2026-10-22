import { say } from './shared/model-mock';
import { FORM_A } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: настройки канала. Каталог сценариев — `SCENARIOS.md`, группа S.
 *
 * Модель для этих тестов не нужна — список моделей отдаёт подмена, поэтому тесты не зависят от
 * того, запущен ли Ollama.
 */

test.describe('Ассистент: настройки канала', () => {
  test('[S2] режим правки выбирается в настройках канала и переживает переподключение', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    test.setTimeout(120_000);
    void model;
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await panel.open();
    await panel.settingsButton.click();

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
    await panel.settingsButton.click();
    await expect(page.getByRole('combobox', { name: 'Как ассистент правит форму' })).toHaveText(
      'Напрямую в файлах формы'
    );
  });

  test('[S3] смена режима правки недоступна, пока идёт ход', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    test.setTimeout(120_000);
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    const gate = model.held(say('Готово.'));
    await panel.send('Подумай.');
    await gate.reached;
    await panel.settingsButton.click();
    // Подключение с другим режимом начинает новый разговор — посреди хода это обрыв ленты (D8).
    await expect(page.getByRole('button', { name: 'Подключить' })).toBeDisabled();

    await panel.settingsButton.click();
    gate.release();
    await panel.waitIdle();
    await expect(panel.message(panel.answer(0))).toHaveText('Готово.');
  });
});
