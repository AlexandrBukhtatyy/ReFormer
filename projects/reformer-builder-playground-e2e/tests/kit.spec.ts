import { test, expect } from './shared/fixtures';

/**
 * Кит из плагина проекта: пакет `kit-hexa-ui` в `.ui_builder/plugins` playground.
 *
 * Его сборка весит около 5 МБ, поэтому в обычную копию проекта каталог кита не входит —
 * эти тесты просят его явно.
 */
const KIT_PLUGIN = 'kit-hexa-ui';

/**
 * Шум HexaUI в консоли: кит объявляет React до 18-го, а билдер работает на 19-м, и antd
 * со styled-components внутри кита пишут предупреждения (README кита, «Ограничения»). Форма при
 * этом рисуется. Сюда попадает только известное — всё прочее по-прежнему проваливает тест.
 */
const KNOWN_KIT_NOISE = [
  /React does not recognize the `%s` prop on a DOM element/,
  /`onSearch` should work with `showSearch`/,
  /Accessing element\.ref was removed in React 19/,
];

test.describe('Кит HexaUI — плагин проекта', () => {
  test('кит появляется в списке китов и рисует форму', async ({ builder, page, pageErrors }) => {
    // Копия проекта тяжелее обычной на сборку плагина, и пространство имён кита грузится лениво.
    test.setTimeout(90_000);
    await builder.openPlayground({ plugins: [KIT_PLUGIN] });

    // Ячейка «кит» — вклад плагина китов. Пока кит один, она подпись; кнопкой она становится,
    // когда плагин внёс второй, — а плагины проекта поднимаются после открытия, поэтому список
    // переоткрывается.
    const cell = builder.statusBar.getByRole('button', { name: 'ReFormer UI Kit' });
    const hexa = page.getByRole('menuitemradio', { name: /Kaspersky HexaUI/ });
    await expect(async () => {
      await cell.click();
      try {
        await expect(hexa).toBeVisible({ timeout: 1_000 });
      } catch (error) {
        await page.keyboard.press('Escape');
        throw error;
      }
    }).toPass();

    // Кит меняется на лету, без перезагрузки.
    await hexa.click();
    await expect(builder.statusBar.getByRole('button', { name: 'Kaspersky HexaUI' })).toBeVisible();

    await builder.openFile('forms/contact/form.schema.json');
    await page
      .getByRole('main', { name: 'Редактор' })
      .getByRole('button', { name: 'Форма', exact: true })
      .click();

    // Рамка кита несёт идентификатор плагина — под ним оболочка изолирует его стили. Поле
    // внутри неё значит, что форму нарисовал именно кит плагина, а не встроенный.
    const frame = page.locator('[data-rb-plugin="kit-hexa-ui"]');
    await expect(frame.getByRole('textbox', { name: 'Как к вам обращаться' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      frame.getByRole('checkbox', { name: 'Согласен на обработку данных' })
    ).toBeVisible();

    const unexpected = pageErrors.filter(
      (message) => !KNOWN_KIT_NOISE.some((pattern) => pattern.test(message))
    );
    pageErrors.splice(0, pageErrors.length, ...unexpected);
  });
});
