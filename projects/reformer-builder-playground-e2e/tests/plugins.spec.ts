import { test, expect } from './shared/fixtures';

/**
 * Плагины проекта. Плагин — пакет в `.ui_builder/plugins/playground-hello`, включённый
 * `settings.json`: исходники в `src/`, а в корне каталога — его сборка. Её билдер и грузит.
 */
test.describe('Плагин проекта', () => {
  test('playground-hello поднят из сборки: его команда есть в палитре', async ({ builder }) => {
    await builder.openPlayground();

    // Плагины каталога проекта поднимаются после открытия отдельной цепочкой, а палитра
    // собирает пункты при открытии — поэтому она переоткрывается, пока вклад не появится.
    await expect(async () => {
      await builder.openPalette('Playground Hello');
      try {
        // Подпись приехала из `locales/ru.json` сборки: значит, прочитан её манифест,
        // слинкован `main.js` и исполнен `activate`. Исходники, тест и конфиги пакета
        // лежат рядом и загрузке не мешают.
        await expect(builder.paletteOption('Playground Hello: привет')).toBeVisible({
          timeout: 1_000,
        });
      } finally {
        await builder.closePalette();
      }
    }).toPass();
  });

  test('ассистент поднят из сборки с модулями данных: его команды есть в палитре', async ({
    builder,
    disk,
  }) => {
    // Сборка ассистента — `main.js` и корпус знаний отдельными файлами в `chunks/`: код
    // импортирует корпус отложенно, и в `main.js` он не вложен. В обычную копию проекта плагин
    // не идёт (тяжёлый), поэтому тест просит его явно.
    test.setTimeout(90_000);
    await builder.openPlayground({ plugins: ['reformer/ai'] });

    expect(await disk.exists('.ui_builder/plugins/reformer/ai/chunks/knowledge-index.js')).toBe(
      true
    );

    await expect(async () => {
      await builder.openPalette('Ассистент');
      try {
        await expect(builder.paletteOption('Ассистент: новый разговор')).toBeVisible({
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

  test('несобранный плагин не поднимается, и билдер называет причину', async ({
    builder,
    disk,
    pageErrors,
  }) => {
    await builder.goto();
    await disk.seed();
    // Как после клона репозитория: пакет плагина на месте, а сборки в его корне ещё нет.
    for (const built of ['manifest.json', 'main.js', 'locales']) {
      await disk.remove(`.ui_builder/plugins/playground-hello/${built}`);
    }

    await builder.openFolder();

    // Поэтому скрипты запуска билдера в playground начинают со сборки плагинов.
    await expect
      .poll(() => builder.shownNotifications())
      .toEqual(['Плагин «playground-hello»: в каталоге «playground-hello» нет manifest.json']);
    // Отказ билдер пишет и в консоль — здесь он ожидаем.
    expect(pageErrors).toHaveLength(1);
    expect(pageErrors[0]).toContain('manifest-missing');
    pageErrors.length = 0;
  });
});
