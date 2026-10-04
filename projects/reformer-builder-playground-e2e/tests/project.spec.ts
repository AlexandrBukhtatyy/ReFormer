import { test, expect } from './shared/fixtures';

/**
 * Открытие проекта: playground как рабочий каталог билдера.
 */
test.describe('Открытие playground', () => {
  test('каталог открывается как проект: дерево и заголовок из конфига проекта', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground();

    for (const name of ['.ui_builder', 'forms', 'builder.launch.json', 'package.json']) {
      await expect(builder.treeItem(name)).toBeVisible();
    }
    // branding.title из `.ui_builder/config.json` проекта перекрыл заголовок конфига запуска.
    await expect(page).toHaveTitle('ReFormer Builder · Playground');
  });

  test('каталоги раскрываются до файлов форм', async ({ builder }) => {
    await builder.openPlayground();

    await builder.expandFolder('forms/contact');

    await expect(builder.treeItem('forms/contact.rjsf.json')).toBeVisible();
    await expect(builder.treeItem('forms/contact/form.schema.json')).toBeVisible();
  });

  test('открытие проекта не меняет его файлы', async ({ builder, disk, page }) => {
    await builder.goto();
    await disk.seed();
    const before = await disk.snapshot();

    await builder.openFolderButton.click();
    // Заголовок проекта встаёт после чтения его конфига и настроек — к этому моменту всё,
    // что открытие могло бы переписать, уже переписано.
    await expect(page).toHaveTitle('ReFormer Builder · Playground');
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
    await expect(page).toHaveTitle('ReFormer Builder · Playground');
    await expect(builder.tab('contact.rjsf.json')).toHaveAttribute('aria-selected', 'true');
  });
});
