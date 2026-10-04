import { existsSync } from 'fs';
import path from 'path';
import { test, expect } from './shared/fixtures';
import { PLAYGROUND_DIR } from './shared/paths';

/**
 * Кит из плагина проекта: `kit-hexa-ui` в `.ui_builder/plugins` playground.
 *
 * Сборка плагина в git не едет (около 5 МБ), поэтому в обычную копию проекта она не попадает,
 * а эти тесты называют её явно — и пропускаются там, где она не собрана.
 */
const KIT_PLUGIN = '.ui_builder/plugins/kit-hexa-ui';
const kitBuilt = existsSync(path.join(PLAYGROUND_DIR, KIT_PLUGIN, 'main.js'));

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
  test.skip(
    !kitBuilt,
    'плагин кита не собран: npm run plugins:hexa-ui -w reformer-builder-playground'
  );

  test('кит появляется в сочетаниях и рисует форму', async ({ builder, page, pageErrors }) => {
    // Копия проекта тяжелее обычной на сборку плагина, и пространство имён кита грузится лениво.
    test.setTimeout(90_000);
    await builder.openPlayground({ ignored: [KIT_PLUGIN] });

    // Ячейка «движок · кит». Сочетания с китом плагина появляются, когда плагин его внёс, —
    // а плагины проекта поднимаются после открытия, поэтому список переоткрывается.
    const cell = builder.statusBar.getByRole('button', {
      name: 'ReFormer + RJSF · ReFormer UI Kit',
    });
    const hexa = page.getByRole('menuitemradio', { name: 'ReFormer + RJSF · Kaspersky HexaUI' });
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
    await expect(
      builder.statusBar.getByRole('button', { name: 'ReFormer + RJSF · Kaspersky HexaUI' })
    ).toBeVisible();

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
