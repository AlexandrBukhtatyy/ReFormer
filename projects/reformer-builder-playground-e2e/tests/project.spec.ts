import { test, expect } from './shared/fixtures';

/**
 * Открытие проекта: playground как рабочий каталог билдера.
 */
test.describe('Открытие playground', () => {
  test('каталог открывается как проект: в дереве его файлы', async ({ builder }) => {
    await builder.openPlayground();

    for (const name of ['.ui_builder', 'forms', 'scripts', 'package.json', 'README.md']) {
      await expect(builder.treeItem(name)).toBeVisible();
    }
  });

  test('каталоги раскрываются до файлов форм', async ({ builder }) => {
    await builder.openPlayground();

    await builder.expandFolder('forms/contact');

    await expect(builder.treeItem('forms/contact.rjsf.json')).toBeVisible();
    await expect(builder.treeItem('forms/contact/form.schema.json')).toBeVisible();
  });

  test('открытие проекта не меняет его файлы', async ({ builder, disk }) => {
    await builder.goto();
    await disk.seed();
    const before = await disk.snapshot();

    await builder.openFolder();
    // Конфиг и настройки прочитаны, плагины подняты — всё, что открытие могло бы переписать,
    // к этому моменту переписано.
    await builder.projectPluginsReady();
    await builder.openFile('forms/contact.rjsf.json');

    expect(await disk.snapshot()).toEqual(before);
  });

  test('после перезагрузки проект восстанавливается без выбора каталога', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground();
    await builder.openFile('forms/contact.rjsf.json');

    await page.reload();

    // Хэндл каталога пережил перезагрузку в IndexedDB — «Открыть папку…» никто не нажимал.
    await expect(builder.projectTree).toBeVisible();
    await expect(builder.tab('contact.rjsf.json')).toHaveAttribute('aria-selected', 'true');
  });
});
