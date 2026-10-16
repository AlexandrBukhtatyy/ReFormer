import { test, expect } from './shared/fixtures';

/**
 * Каталог без `.ui_builder` — чужой проект, который билдер видит впервые: ни конфига, ни
 * настроек, ни плагинов. Открывается как любой другой: дерево, редакторы и движки приходят
 * слоем плагинов приложения (у собранного билдера — из `dist/plugins/`, под dev-сервером —
 * по умолчанию из сборок на месте), а настройки проекта до появления каталога живут
 * в браузере. Сам билдер в каталоге ничего не создаёт.
 */
test.describe('Каталог без .ui_builder', () => {
  test('открывается: дерево, редакторы движков — и в каталоге ничего не появилось', async ({
    builder,
    disk,
    page,
  }) => {
    await builder.goto();
    await disk.seed({ uiBuilder: false });
    const before = await disk.snapshot();
    expect(Object.keys(before).some((filePath) => filePath.startsWith('.ui_builder/'))).toBe(false);

    await builder.openFolder();

    await expect(builder.treeItem('forms')).toBeVisible();
    await builder.openFile('forms/contact/form.schema.json');
    await expect(page.getByRole('tree', { name: 'Дерево схемы формы' })).toBeVisible();
    await builder.openFile('forms/contact.rjsf.json');
    await expect(page.getByTestId('rjsf-editor')).toBeVisible();

    // Плагины приложения пишут настройки области и при старте (выбор кита); без каталога
    // `.ui_builder` они остаются в браузере, а каталог в чужой папке не появляется.
    expect(await disk.snapshot()).toEqual(before);
  });

  test('после перезагрузки проект восстанавливается', async ({ builder, disk, page }) => {
    await builder.goto();
    await disk.seed({ uiBuilder: false });
    await builder.openFolder();
    await builder.openFile('forms/contact.rjsf.json');

    await page.reload();

    await expect(builder.projectTree).toBeVisible();
    await expect(builder.tab('contact.rjsf.json')).toHaveAttribute('aria-selected', 'true');
  });
});
