import { test, expect } from './shared/fixtures';

/**
 * Плагины проекта: `.ui_builder/plugins/<id>/` playground, включённые его `settings.json`.
 */
test.describe('Плагин проекта', () => {
  test('playground-hello поднят из исходников: его команда есть в палитре', async ({ builder }) => {
    await builder.openPlayground();

    // Плагины каталога проекта поднимаются после открытия отдельной цепочкой, а палитра
    // собирает пункты при открытии — поэтому она переоткрывается, пока вклад не появится.
    await expect(async () => {
      await builder.openPalette('Playground Hello');
      try {
        // Подпись приехала из `locales/ru.json` плагина: значит, прочитан манифест,
        // транспилирован `src/main.ts` и исполнен `activate`.
        await expect(builder.paletteOption('Playground Hello: привет')).toBeVisible({
          timeout: 1_000,
        });
      } finally {
        await builder.closePalette();
      }
    }).toPass();
  });

  test('оболочка предлагает управление плагином проекта', async ({ builder }) => {
    await builder.openPlayground();
    await builder.projectPluginsReady();

    await builder.openPalette('Playground Hello');

    await expect(builder.paletteOption('Плагины: выключить «Playground Hello»')).toBeVisible();
    await expect(
      builder.paletteOption('Плагины: наблюдать «Playground Hello» — режим разработки')
    ).toBeVisible();
  });
});
