import { test, expect } from './shared/fixtures';

/**
 * Плагины приложения: приехали вместе с собранным билдером и работают для любого проекта.
 *
 * Слой есть только у СОБРАННОГО билдера (`BUILDER_E2E_TARGET=dist`): плагины лежат рядом со
 * сборкой, в `dist/plugins/`. Под dev-сервером слоя нет — там плагины остаются плагинами
 * открытого проекта, и их покрывают остальные файлы набора.
 */
test.describe('Плагины приложения', () => {
  test.skip(
    process.env.BUILDER_E2E_TARGET !== 'dist',
    'слой плагинов приложения есть только у собранного билдера'
  );

  test('проект без своих плагинов открывает формы редакторами движков', async ({
    builder,
    disk,
    page,
  }) => {
    // Так выглядит чужой проект: формы есть, каталога плагинов нет.
    await builder.goto();
    await disk.seed({ projectPlugins: false });
    await builder.openFolder();

    await builder.openFile('forms/contact.rjsf.json');
    await expect(page.getByTestId('rjsf-editor')).toBeVisible();
    await expect(page.getByTestId('rjsf-row-name')).toBeVisible();

    await builder.openFile('forms/contact/form.schema.json');
    await expect(page.getByRole('tree', { name: 'Дерево схемы формы' })).toBeVisible();
  });

  test('команды плагинов приложения есть в палитре до открытия проекта', async ({ builder }) => {
    await builder.goto();

    await builder.openPalette('Ассистент');

    // Ассистент — плагин приложения; плагин проекта без открытого проекта не исполняется вовсе.
    await expect(builder.paletteOption('Ассистент: новый разговор')).toBeVisible();
  });

  test('раздел «Плагины» называет слой и не даёт выключить плагин приложения', async ({
    builder,
    page,
  }) => {
    await builder.goto();

    await builder.openPalette('Настройки');
    await builder.palette.getByRole('option').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Плагины' }).click();

    const toggle = page.getByTestId('settings-plugin-reformer.rjsf.editor-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();
    await expect(toggle).toBeDisabled();
    await expect(page.getByTestId('settings-plugins')).toContainText('приложение');
  });
});
