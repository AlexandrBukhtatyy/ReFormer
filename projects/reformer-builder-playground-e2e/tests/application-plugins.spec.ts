import path from 'path';
import { test, expect } from './shared/fixtures';

/** Скриншоты визуальной проверки — рядом с остальными снимками билдера (в git не едут). */
const SHOTS = path.resolve(__dirname, '../../react-playground-e2e/screenshots/builder-app-plugins');

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

  test('пустой слой — чистая оболочка: стартовая страница и ни слова о формах', async ({
    builder,
    page,
  }) => {
    // Оболочка — база для разных приложений. Без плагинов приложения от конструктора форм
    // в ней остаётся только имя, которым приложение назвало себя: ни дерева, ни редакторов,
    // ни китов, ни текстов о формах — ни в интерфейсе, ни в палитре команд.
    await page.route('**/plugins/index.json', (route) =>
      route.fulfill({ json: { version: 1, plugins: [] } })
    );
    await builder.goto();

    await expect(page.getByRole('heading', { name: 'Начало работы' })).toBeVisible();
    await expect(builder.statusBar).toContainText('Конструктор');
    await expect(builder.statusBar).not.toContainText('ReFormer UI Kit');

    // Слова предметной области — от начала слова: «формат» и «информация» не в счёт.
    const SUBJECT = /(?<![а-яё])форм(?!ат)|(?<![а-яё])кит(?![а-яё])|превью|схем/i;
    expect(await page.locator('body').innerText()).not.toMatch(SUBJECT);

    await builder.openPalette();
    const commands = await builder.palette.getByRole('option').allInnerTexts();
    expect(commands.length).toBeGreaterThan(3);
    expect(commands.filter((title) => SUBJECT.test(title))).toEqual([]);
    await builder.closePalette();

    await page.screenshot({ path: path.join(SHOTS, '13-clean-shell.png') });
  });

  test('команды плагинов приложения есть в палитре до открытия проекта', async ({ builder }) => {
    await builder.goto();

    await builder.openPalette('Ассистент');

    // Ассистент — плагин приложения; плагин проекта без открытого проекта не исполняется вовсе.
    await expect(builder.paletteOption('Ассистент: новый разговор')).toBeVisible();
  });

  test('платформа форм работает до открытия проекта: кит назван своей ячейкой', async ({
    builder,
  }) => {
    await builder.goto();

    // Киты — плагин приложения. Его ячейка стоит в строке состояния рядом со встроенным выбором
    // профиля; кит пока один, поэтому это подпись, а не переключатель.
    await expect(builder.statusBar).toContainText('Конструктор');
    await expect(builder.statusBar).toContainText('ReFormer UI Kit');
  });

  test('копия плагина приложения в проекте уступает молча', async ({ builder, page }) => {
    // Образец включает у себя и киты, и движки — те же плагины, что приехали с приложением.
    // Двойной активации быть не должно: работает экземпляр приложения, копия помечена.
    await builder.openPlayground();

    await builder.openPalette('Настройки');
    await builder.palette.getByRole('option').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Плагины' }).click();

    await expect(page.getByTestId('settings-plugins')).toContainText(
      'перекрывает копию из проекта'
    );
    // Форма при этом открывается редактором: уступившая копия ничего не сломала.
    await page.keyboard.press('Escape');
    await builder.openFile('forms/contact/form.schema.json');
    await expect(page.getByRole('tree', { name: 'Дерево схемы формы' })).toBeVisible();
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
