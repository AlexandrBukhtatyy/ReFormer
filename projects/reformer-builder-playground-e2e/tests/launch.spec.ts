import { test, expect } from './shared/fixtures';

/**
 * Запуск: билдер собран конфигом запуска — `.ui_builder/config.json` playground. Проект ещё
 * не открыт.
 */
test.describe('Запуск билдера', () => {
  test('конфиг запуска применён: заголовок, состав и локаль', async ({ builder, page }) => {
    await builder.goto();

    // branding.title.
    await expect(page).toHaveTitle('ReFormer Builder · Playground');
    // Профиль `playground` из конфига: его имя стоит в ячейке «движок · кит» строки состояния.
    await expect(
      builder.statusBar.getByRole('button', { name: 'ReFormer + RJSF · ReFormer UI Kit' })
    ).toBeVisible();
    // defaults.locale.
    await expect(builder.statusBar).toContainText('Язык: RU');
  });

  test('без проекта показана стартовая страница', async ({ builder, page }) => {
    await builder.goto();

    await expect(page.getByRole('heading', { name: 'Начало работы' })).toBeVisible();
    await expect(builder.openFolderButton).toBeEnabled();
    await expect(builder.statusBar).toContainText('Рабочая область не открыта');
    await expect(builder.projectTree).toBeHidden();
  });
});
