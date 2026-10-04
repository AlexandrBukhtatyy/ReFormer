import { test, expect } from './shared/fixtures';

/**
 * Формы playground в редакторах обоих движков: состав `ReFormer + RJSF` конфига запуска.
 */
test.describe('Форма RJSF', () => {
  const FORM = 'forms/contact.rjsf.json';

  test('открывается редактором RJSF со структурой полей', async ({ builder, page }) => {
    await builder.openPlayground();
    await builder.openFile(FORM);

    await expect(page.getByTestId('rjsf-editor')).toBeVisible();
    const fields = page.getByRole('list', { name: 'Поля формы' }).getByRole('listitem');
    await expect(fields).toHaveCount(4);
    for (const name of ['name', 'age', 'channel', 'agree']) {
      await expect(page.getByTestId(`rjsf-row-${name}`)).toBeVisible();
    }
  });

  test('правка сохраняется в каталог проекта', async ({ builder, disk, page }) => {
    await builder.openPlayground();
    await builder.openFile(FORM);

    await page
      .getByRole('navigation', { name: 'Панели справа' })
      .getByRole('button', { name: 'Свойства' })
      .click();
    await page.getByTestId('rjsf-title').fill('Контакт (e2e)');

    // До сохранения правка живёт в рабочей копии: документ помечен, на диске — прежнее.
    await expect(builder.statusBar).toContainText('1 несохранённый файл');
    await expect(builder.tab('contact.rjsf.json')).toHaveAccessibleName(/несохранённые изменения/);
    expect(JSON.parse(await disk.readText(FORM)).schema.title).toBe('Контакт');

    await builder.save();

    await expect(builder.statusBar).toContainText('Всё сохранено');
    expect(JSON.parse(await disk.readText(FORM)).schema.title).toBe('Контакт (e2e)');
  });
});

test.describe('Форма ReFormer', () => {
  test('открывается редактором схемы с деревом узлов', async ({ builder, page }) => {
    await builder.openPlayground();
    await builder.openFile('forms/contact/form.schema.json');

    const schemaTree = page.getByRole('tree', { name: 'Дерево схемы формы' });
    await expect(schemaTree).toBeVisible();
    for (const field of ['Имя', 'Email', 'Как связаться', 'Согласен на обработку данных']) {
      await expect(schemaTree.getByRole('treeitem', { name: field })).toBeVisible();
    }
    // Палитра компонентов — вклад стека ReFormer: появляется только у его документа.
    await expect(
      page
        .getByRole('navigation', { name: 'Панели слева' })
        .getByRole('button', { name: 'Компоненты' })
    ).toBeVisible();
  });
});
