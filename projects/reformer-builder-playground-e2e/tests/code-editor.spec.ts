import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './shared/fixtures';

/**
 * Редактор кода: плагин `reformer.editor-monaco` из домена `base`.
 *
 * Движок Monaco едет ВНУТРИ плагина: код — отложенным модулем сборки, воркеры — текстом,
 * запускаемым из Blob-URL, стили — таблицей плагина под его скоупом, шрифт значков — data-URL
 * в ней же. Каждое из четырёх ломается молча: редактор без стилей — это текст без раскладки,
 * без воркера — подсветка есть, а подсказок нет, без шрифта — пустые квадраты на кнопках.
 * Поэтому проверяется не «редактор появился», а то, что видит человек.
 */

/** Скриншоты визуальной проверки — рядом с остальными снимками билдера (в git не едут). */
const SHOTS = path.resolve(__dirname, '../../react-playground-e2e/screenshots/builder-app-plugins');

const MONACO_SCOPE = '[data-rb-plugin="reformer.editor-monaco"]';

const SCRATCH = [
  '// заметка: файла в образце нет, его кладёт тест',
  'export function greet(name: string): string {',
  '  const count = 42;',
  '  return `привет, ${name} × ${count}`;',
  '}',
  '',
].join('\n');

/** Видимый редактор: у неактивной вкладки тело может оставаться в документе скрытым. */
const editorOf = (page: Page): Locator =>
  page.locator(`${MONACO_SCOPE} .monaco-editor`).filter({ visible: true }).first();

/** Сколько разных цветов у лексем на экране: один — значит подсветка не сработала. */
const tokenColors = (editor: Locator): Promise<number> =>
  editor.evaluate(
    (element) =>
      new Set(
        [...element.querySelectorAll('.view-line span span')].map(
          (token) => getComputedStyle(token).color
        )
      ).size
  );

/** Яркость цвета пикселем холста — строку `oklch(…)`/`rgb(…)` руками не разбираем. */
function luminanceOf(page: Page, color: string): Promise<number> {
  return page.evaluate((value) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (context === null) return Number.NaN;
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }, color);
}

test.describe('Редактор кода', () => {
  test('JSON и TypeScript открываются с раскладкой и подсветкой из таблицы плагина', async ({
    builder,
    page,
  }) => {
    await builder.goto();
    await builder.disk.seed();
    await builder.disk.writeText('scratch.ts', SCRATCH);
    await builder.openFolder();

    await builder.openFile('package.json');
    const editor = editorOf(page);
    await expect(editor).toBeVisible();
    await expect(editor.locator('.view-lines')).toContainText('reformer-builder-playground');

    // Раскладка — из таблицы стилей плагина: без неё строки редактора не абсолютны и текст
    // складывается обычным потоком, поверх номеров строк.
    expect(
      await editor
        .locator('.view-line')
        .first()
        .evaluate((line) => getComputedStyle(line).position)
    ).toBe('absolute');
    // Ключи и значения JSON окрашены по-разному.
    await expect.poll(() => tokenColors(editor)).toBeGreaterThanOrEqual(2);

    // Контейнер объявлений для скринридера лежит в скоупе плагина и убран за край экрана.
    // В `document.body` его правило не действовало бы, и объявления всплывали бы текстом.
    const aria = page.locator('.monaco-aria-container');
    await expect(aria.first()).toBeAttached();
    expect(await page.locator('body > .monaco-aria-container').count()).toBe(0);
    expect(await aria.first().evaluate((node) => getComputedStyle(node).position)).toBe('absolute');

    await page.screenshot({ path: path.join(SHOTS, '08-code-editor-json.png') });

    await builder.openFile('scratch.ts');
    const source = editorOf(page);
    await expect(source.locator('.view-lines')).toContainText('export function greet');
    // Комментарий, ключевое слово, строка, число — подсветка без языковой службы, одним
    // определением языка, которое приезжает своим отложенным файлом.
    await expect.poll(() => tokenColors(source)).toBeGreaterThanOrEqual(3);

    await page.screenshot({ path: path.join(SHOTS, '09-code-editor-typescript.png') });
  });

  test('поиск по файлу: виджет нарисован своими стилями, значки — своим шрифтом', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground();
    await builder.openFile('package.json');
    const editor = editorOf(page);
    await editor.locator('.view-lines').click();
    await page.keyboard.press('ControlOrMeta+f');

    const find = editor.locator('.find-widget');
    await expect(find).toHaveClass(/(^|\s)visible(\s|$)/);
    const box = await find.boundingBox();
    // Виджет — плашка в правом верхнем углу редактора, а не блок во всю ширину под текстом.
    expect(box?.width ?? 0).toBeGreaterThan(250);
    expect(box?.height ?? 0).toBeLessThan(80);

    // Значки — шрифтом, который оболочка переименовала под плагин: и объявление шрифта,
    // и ссылки на него переписаны согласованно, сам шрифт вложен в таблицу и загружен.
    const icon = find.locator('.codicon').first();
    await expect(icon).toBeVisible();
    const family = await icon.evaluate((node) => getComputedStyle(node).fontFamily);
    expect(family).toContain('codicon');
    await expect
      .poll(() => page.evaluate((name) => document.fonts.check(`16px ${name}`), family))
      .toBe(true);

    await page.keyboard.type('reformer');
    await expect(find.locator('.matchesCount')).toContainText(/\d+\s*(из|of)\s*\d+/);
    await page.screenshot({ path: path.join(SHOTS, '10-code-editor-find.png') });
  });

  test('исходник схемы формы: подсказки по схеме приходят из воркера', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground();
    await builder.openFile('forms/contact/form.schema.json');
    await expect(page.getByRole('tree', { name: 'Дерево схемы формы' })).toBeVisible();

    // Исходник показывает редактор схемы, а тело — редактора кода: оно одолжено возможностью
    // и рисуется во вкладе ДРУГОГО плагина. Свой скоуп тело несёт само — иначе его таблица
    // стилей здесь не действовала бы.
    await builder.openPalette('Показать исходник');
    await builder.paletteOption('Показать исходник').click();
    const editor = editorOf(page);
    await expect(editor).toBeVisible();
    await expect(editor.locator('.view-lines')).toContainText('"$schema"');

    // Новое свойство в корне схемы: подсказка обязана назвать ключи из JSON Schema формата.
    // Считает её языковая служба JSON в воркере, а воркер запущен из Blob-URL — текста в сборке.
    await editor.locator('.view-lines').click();
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ControlOrMeta+Space');

    const suggest = editor.locator('.suggest-widget');
    await expect(suggest).toHaveClass(/(^|\s)visible(\s|$)/);
    const rows = suggest.locator('.monaco-list-row');
    await expect(rows.first()).toBeVisible();
    // Строки списка — в одну линию каждая: без стилей списка они сложились бы в столбик текста.
    const row = await rows.first().boundingBox();
    expect(row?.height ?? 0).toBeGreaterThan(10);
    expect(row?.height ?? 0).toBeLessThan(40);

    await page.screenshot({ path: path.join(SHOTS, '11-code-editor-schema-hints.png') });
  });

  test('тёмная тема: редактор темнеет вместе с оболочкой', async ({ builder, page }) => {
    await builder.openPlayground();
    await builder.openPalette('Настройки');
    await builder.palette.getByRole('option').first().click();
    await page.getByTestId('setting-theme').click();
    await page.getByRole('option', { name: 'Тёмная' }).click();
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
    const dialog = page.getByTestId('settings-dialog');
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 1000 });
    }).toPass();

    await builder.openFile('package.json');
    const editor = editorOf(page);
    await expect(editor).toBeVisible();
    await expect.poll(() => tokenColors(editor)).toBeGreaterThanOrEqual(2);

    const background = await luminanceOf(
      page,
      await editor
        .locator('.monaco-editor-background')
        .first()
        .evaluate((node) => getComputedStyle(node).backgroundColor)
    );
    expect(background).toBeLessThan(0.2);

    await page.screenshot({ path: path.join(SHOTS, '12-code-editor-dark.png') });
  });
});
