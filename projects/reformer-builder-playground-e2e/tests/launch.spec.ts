import { test, expect } from './shared/fixtures';

/**
 * Запуск: билдер собран конфигом запуска — `.ui_builder/config.json` playground. Проект ещё
 * не открыт.
 */
test.describe('Запуск билдера', () => {
  test('конфиг запуска применён: заголовок, профиль и локаль', async ({ builder, page }) => {
    await builder.goto();

    // branding.title.
    await expect(page).toHaveTitle('ReFormer Builder · Playground');
    // Состава конфиг не задаёт: движки — плагины проекта. В строке состояния — встроенный
    // профиль билдера и кит по умолчанию; выбирать пока не из чего, поэтому это подпись,
    // а не переключатель.
    await expect(builder.statusBar).toContainText('Конструктор · ReFormer UI Kit');
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
