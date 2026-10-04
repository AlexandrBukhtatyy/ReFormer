import { test, expect } from './shared/fixtures';

/**
 * Конфиг билдера: `.ui_builder/config.json` playground читается дважды — лаунчером до сборки
 * приложения и приложением при открытии проекта. Это один и тот же файл: раскладка «запустил
 * в корне проекта и его же открыл».
 */
const CONFIG = '.ui_builder/config.json';

test.describe('Конфиг: один файл на запуск и проект', () => {
  test('проект открывается без уведомлений', async ({ builder }) => {
    await builder.openPlayground();
    await builder.projectPluginsReady();

    // Два повода для уведомления, и оба здесь не срабатывают. Поля уровня запуска (`preset`,
    // `profiles`, `defaults`) в конфиге проекта совпадают с конфигом запуска — билдер о них
    // молчит. А `kit-hexa-ui`, включённый настройкой проекта, в копии не лежит: его каталог
    // берёт только тест кита, и включённый плагин без каталога пропускается.
    expect(await builder.shownNotifications()).toEqual([]);
  });

  test('заголовок из конфига проекта перекрывает заголовок запуска', async ({
    builder,
    disk,
    page,
  }) => {
    await builder.goto();
    await disk.seed();
    await expect(page).toHaveTitle('ReFormer Builder · Playground');

    // Проект разошёлся с конфигом запуска одним полем — тем, что действует на уровне проекта.
    const config = JSON.parse(await disk.readText(CONFIG));
    config.branding.title = 'Формы проекта';
    await disk.writeText(CONFIG, JSON.stringify(config, null, 2));

    await builder.openFolder();

    await expect(page).toHaveTitle('Формы проекта');
    await builder.projectPluginsReady();
    expect(await builder.shownNotifications()).toEqual([]);
  });

  test('состав, записанный в проекте иначе, чем при запуске, называется предупреждением', async ({
    builder,
    disk,
  }) => {
    await builder.goto();
    await disk.seed();

    // Проект просит другой состав. Применить его нечем — приложение уже собрано, — и это
    // говорится словами. Остальные поля уровня запуска совпали и в сообщение не попадают.
    const config = JSON.parse(await disk.readText(CONFIG));
    config.preset = 'rjsf.builder';
    await disk.writeText(CONFIG, JSON.stringify(config, null, 2));

    await builder.openFolder();
    await builder.projectPluginsReady();

    expect(await builder.shownNotifications()).toEqual([
      'Конфиг проекта (.ui_builder/config.json): «preset» действует только на уровне запуска — задайте его в конфиге лаунчера',
    ]);
  });
});
