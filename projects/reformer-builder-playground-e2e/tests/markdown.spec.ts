import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './shared/fixtures';

/**
 * Предпросмотр markdown: плагин `reformer.editor-markdown` из домена `base`.
 *
 * Плагин уехал из билдера и везёт с собой то, что раньше лежало в CSS билдера: типографику
 * (`prose`) и палитру подсветки кода. Класс без правила молчит — вёрстка не падает, а теряет
 * размер заголовка или цвет ключевого слова, — поэтому проверяется вычисленный стиль, а не
 * наличие элементов.
 */

/** Скриншоты визуальной проверки — рядом с остальными снимками билдера (в git не едут). */
const SHOTS = path.resolve(__dirname, '../../react-playground-e2e/screenshots/builder-app-plugins');

/**
 * Яркость цвета в том виде, в каком его отдал браузер (`oklch(…)`, `rgb(…)`): цвет рисуется
 * на холсте и читается обратно пикселем. Разбирать строку руками нельзя — у `oklch` первое
 * число уже яркость, у `rgb` — красный канал, и одно и то же сравнение значило бы разное.
 */
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

test.describe('Предпросмотр markdown', () => {
  test('README открывается рендером: заголовок, типографика и подсветка — из таблицы плагина', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground();
    await builder.openFile('README.md');
    // Файл открывается исходником; предпросмотр — кнопкой в полосе вкладок.
    await page.getByRole('button', { name: 'Показать предпросмотр' }).click();

    // Заголовок документа — настоящий `h1`, а не строка с решёткой: файл показан рендером.
    const heading = page.getByRole('heading', { level: 1, name: 'reformer-builder-playground' });
    await expect(heading).toBeVisible();

    // Типографика: у заголовка `prose` жирность 800. Без таблицы стилей плагина заголовок
    // остался бы обычным текстом — правила для `prose` в CSS билдера больше нет.
    await expect
      .poll(() => heading.evaluate((element) => getComputedStyle(element).fontWeight))
      .toBe('800');

    // Утилита сильнее типографики: ширину колонки (65ch у `prose`) снимает утилита, правило
    // которой осталось в CSS билдера. Под скоупом плагина типографика становилась сильнее неё,
    // и предпросмотр молча сужался до узкой колонки.
    const column = page.getByTestId('markdown-preview').locator('.prose');
    expect(await column.evaluate((element) => getComputedStyle(element).maxWidth)).toBe('none');

    // Подсветка кода — на настоящем блоке README, а не на подставленном узле: проверяется сразу
    // и то, что движок подсветки в бандле плагина работает, и то, что палитра доехала. Палитра —
    // постоянный блок той же таблицы; комментарий в ней приглушён и набран курсивом. Ссылка
    // палитры на необъявленную переменную дала бы здесь унаследованный цвет — так и было, пока
    // она ссылалась на переменные темы Tailwind, которые билдер объявляет только для себя.
    const comment = page.locator('code.hljs .hljs-comment').first();
    await expect(comment).toBeAttached();
    const colors = await comment.evaluate((element) => {
      const block = element.closest('code');
      const style = getComputedStyle(element);
      return {
        text: block === null ? null : getComputedStyle(block).color,
        body: getComputedStyle(document.body).color,
        comment: style.color,
        fontStyle: style.fontStyle,
      };
    });
    // Текст блока — цвет текста оболочки, а не светлый цвет «тёмного блока» типографики:
    // фон у блока свой, светлый, и унаследованный цвет на нём не читался.
    expect(colors.text).toBe(colors.body);
    expect(colors.comment).not.toBe(colors.text);
    expect(colors.fontStyle).toBe('italic');

    await page.screenshot({ path: path.join(SHOTS, '04-markdown-preview-light.png') });
    await comment.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '06-markdown-code-light.png') });
  });

  test('тёмная тема: типографика и подсветка переключаются вместе с оболочкой', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground();

    // Образец закрепляет светлую тему умолчанием (`.ui_builder/config.json`), поэтому системное
    // предпочтение её не переключит: тёмную выбирает человек в настройках.
    await builder.openPalette('Настройки');
    await builder.palette.getByRole('option').first().click();
    await page.getByTestId('setting-theme').click();
    await page.getByRole('option', { name: 'Тёмная' }).click();
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
    // Первый Escape может достаться списку выбора, пока тот закрывается, — диалог закрывается
    // до результата, а не одним нажатием.
    const dialog = page.getByTestId('settings-dialog');
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 1000 });
    }).toPass();

    await builder.openFile('README.md');
    await page.getByRole('button', { name: 'Показать предпросмотр' }).click();

    const heading = page.getByRole('heading', { level: 1, name: 'reformer-builder-playground' });
    await expect(heading).toBeVisible();

    // `dark:prose-invert` переключает палитру типографики вместе с темой оболочки: заголовок
    // обязан быть светлее фона. Сравнивается яркость, а не точный цвет.
    const background = await luminanceOf(
      page,
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    );
    const text = await luminanceOf(
      page,
      await heading.evaluate((element) => getComputedStyle(element).color)
    );
    expect(background).toBeLessThan(0.2);
    expect(text).toBeGreaterThan(0.6);

    // Палитра подсветки — на токенах кита, поэтому тёмная получается сама: комментарий светлее фона.
    const comment = page.locator('code.hljs .hljs-comment').first();
    await expect(comment).toBeAttached();
    const commentLight = await luminanceOf(
      page,
      await comment.evaluate((element) => getComputedStyle(element).color)
    );
    expect(commentLight).toBeGreaterThan(background + 0.2);

    await page.screenshot({ path: path.join(SHOTS, '05-markdown-preview-dark.png') });
    await comment.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, '07-markdown-code-dark.png') });
  });
});
