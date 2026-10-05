import type { Page } from '@playwright/test';
import { test, expect } from './shared/fixtures';

/**
 * Запуск собранного билдера: что читается до первого кадра и сколько это занимает.
 *
 * Оболочка ставит меры запуска сама (`shell/platform/primitives/trace`): здесь они только
 * читаются. Утверждается СОСТАВ — какие файлы плагинов запрошены до первого кадра, — а время
 * только печатается: порог по миллисекундам мигал бы от машины к машине и ничего бы не стерёг.
 *
 * Только собранный билдер (`BUILDER_E2E_TARGET=dist`): под dev-сервером слоя плагинов
 * приложения нет, а модули едут несобранными — мерить там нечего.
 */

interface StartupReport {
  /** Время первого кадра от начала навигации, мс. */
  readonly firstFrame: number;
  /** Меры, сложенные по фазе (часть имени до двоеточия): число и сумма, мс. */
  readonly totals: Readonly<Record<string, { count: number; ms: number }>>;
  /** Самые долгие отдельные меры — чтобы видеть, чей это вклад. */
  readonly slowest: ReadonlyArray<{ name: string; ms: number }>;
  /** Запросы до первого кадра по группам: число файлов и байты после распаковки. */
  readonly resources: Readonly<Record<string, { files: number; bytes: number }>>;
  /** Файлы плагинов, запрошенные до первого кадра, — пути от каталога `plugins/`. */
  readonly pluginFiles: readonly string[];
  /** Самые тяжёлые чанки оболочки, запрошенные до первого кадра. */
  readonly largestAssets: ReadonlyArray<{ name: string; bytes: number }>;
}

async function startupReport(page: Page): Promise<StartupReport> {
  await page.waitForFunction(
    () => performance.getEntriesByName('rb:first-frame', 'measure').length > 0,
    undefined,
    { timeout: 120_000 }
  );
  return page.evaluate(() => {
    const round = (value: number): number => Math.round(value);
    const measures = performance
      .getEntriesByType('measure')
      .filter((entry) => entry.name.startsWith('rb:'));
    const firstFrame = measures.find((entry) => entry.name === 'rb:first-frame')?.duration ?? 0;
    const before = measures.filter((entry) => entry.startTime <= firstFrame);

    const totals: Record<string, { count: number; ms: number }> = {};
    for (const entry of before) {
      const name = entry.name.slice('rb:'.length);
      const at = name.indexOf(':');
      const phase = at < 0 ? name : name.slice(0, at);
      const total = (totals[phase] ??= { count: 0, ms: 0 });
      total.count += 1;
      total.ms = round(total.ms + entry.duration);
    }

    const slowest = before
      .filter((entry) => entry.name.includes(':', 'rb:'.length))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
      .map((entry) => ({ name: entry.name.slice('rb:'.length), ms: round(entry.duration) }));

    const requests = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((entry) => entry.startTime <= firstFrame)
      .map((entry) => ({ path: new URL(entry.name).pathname, bytes: entry.decodedBodySize }));
    const group = (marker: string): { files: number; bytes: number } => {
      const own = requests.filter((request) => request.path.includes(marker));
      return { files: own.length, bytes: own.reduce((sum, request) => sum + request.bytes, 0) };
    };
    const pluginFiles = requests
      .map((request) => request.path.split('/plugins/')[1])
      .filter((path): path is string => path !== undefined)
      .sort();

    const largestAssets = requests
      .filter((request) => request.path.includes('/assets/'))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map((request) => ({ name: request.path.split('/').pop() ?? '', bytes: request.bytes }));

    return {
      firstFrame: round(firstFrame),
      totals,
      slowest,
      largestAssets,
      resources: { plugins: group('/plugins/'), assets: group('/assets/') },
      pluginFiles,
    };
  });
}

const kb = (bytes: number): string => `${String(Math.round(bytes / 1024))} КБ`;

function print(label: string, report: StartupReport): void {
  const phases = Object.entries(report.totals)
    .sort(([, a], [, b]) => b.ms - a.ms)
    .map(
      ([phase, total]) =>
        `${phase} ${String(total.ms)} мс${total.count > 1 ? ` ×${String(total.count)}` : ''}`
    )
    .join(' · ');
  console.log(
    [
      `ЗАМЕР [${label}] первый кадр: ${String(report.firstFrame)} мс`,
      `  плагины: ${String(report.resources.plugins.files)} файлов, ${kb(report.resources.plugins.bytes)}` +
        ` · чанки оболочки: ${String(report.resources.assets.files)} файлов, ${kb(report.resources.assets.bytes)}`,
      `  фазы: ${phases}`,
      `  дольше всех: ${report.slowest.map((item) => `${item.name} ${String(item.ms)} мс`).join(' · ')}`,
      `  чанки плагинов: ${report.pluginFiles.filter((path) => path.includes('/chunks/')).join(' · ') || '—'}`,
      `  тяжёлые чанки оболочки: ${report.largestAssets.map((item) => `${item.name} ${kb(item.bytes)}`).join(' · ')}`,
    ].join('\n')
  );
}

test.describe('Запуск собранного билдера', () => {
  test.skip(
    process.env.BUILDER_E2E_TARGET !== 'dist',
    'замер запуска — только на собранном билдере со слоем плагинов приложения'
  );

  test('до первого кадра: меры на месте, слой плагинов приложения поднят', async ({
    builder,
    page,
  }) => {
    await builder.goto();
    const report = await startupReport(page);
    print('локально', report);

    // Без этих мер сводка врала бы молча: «0 мс» у шага, которого просто не измерили.
    expect(Object.keys(report.totals)).toEqual(
      expect.arrayContaining([
        'ready.settings',
        'ready.locale',
        'ready.builtins',
        'ready.app-plugins',
        'plugin.read',
        'plugin.link',
        'plugin.activate',
        'first-frame',
      ])
    );
    // Каждый плагин слоя прочитан и активирован до первого кадра — по одной мере на плагин.
    expect(report.totals['plugin.read']?.count).toBeGreaterThanOrEqual(10);
    expect(report.totals['plugin.activate']?.count).toBe(report.totals['plugin.read']?.count);
    expect(report.pluginFiles).toContain('index.json');
    expect(report.pluginFiles).toContain('base/files/main.js');

    // Тяжёлое не читается, пока до него не дошло дело: движок редактора кода, предпросмотр
    // markdown и формы, база знаний ассистента стоят за отложенным импортом. До чтения по
    // требованию каталог плагина читался целиком — одиннадцать мегабайт на каждый запуск.
    const heavy = report.pluginFiles.filter((path) =>
      /\/chunks\/(monaco-runtime-|MarkdownPreview-|RjsfPreview-|knowledge-|byok-)/.test(path)
    );
    expect(heavy).toEqual([]);
    // Порог по байтам, а не по времени: он не зависит от машины. Сейчас до первого кадра
    // читается около 1,3 МБ файлов плагинов; три — запас на рост, а не на возврат к прежнему.
    expect(report.resources.plugins.bytes).toBeLessThan(3 * 1024 * 1024);
  });

  test('медленная сеть: то же самое с задержкой и узким каналом', async ({ page }) => {
    test.setTimeout(180_000);
    // Условия ближе к Pages, чем к лаунчеру на той же машине: 40 мс задержки, 20 Мбит/с.
    // Канал режет НЕСЖАТЫЕ байты (лаунчер не сжимает), так что цифра — верхняя оценка.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: (20 * 1024 * 1024) / 8,
      uploadThroughput: (5 * 1024 * 1024) / 8,
    });

    // Без ожидания строки состояния из POM: у него десять секунд, а узкий канал может дольше.
    await page.goto('/');
    const report = await startupReport(page);
    print('40 мс, 20 Мбит/с', report);

    expect(report.firstFrame).toBeGreaterThan(0);
  });

  test('после дочитки в простое редактор кода открывается без сервера плагинов', async ({
    builder,
    page,
  }) => {
    test.setTimeout(180_000);
    await builder.goto();
    await builder.disk.seed();
    await builder.openFolder();

    // Отложенный код плагинов оболочка дочитывает сама, когда запуск закончен и страница
    // простаивает. Мера ставится по окончании дочитки.
    await page.waitForFunction(
      () => performance.getEntriesByName('rb:plugins.preload', 'measure').length > 0,
      undefined,
      { timeout: 120_000 }
    );
    const preload = await page.evaluate(() => {
      const [measure] = performance.getEntriesByName('rb:plugins.preload', 'measure');
      const chunks = (
        performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      ).filter((entry) => new URL(entry.name).pathname.includes('/chunks/'));
      return {
        ms: Math.round(measure?.duration ?? 0),
        files: chunks.length,
        bytes: chunks.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      };
    });
    console.log(
      `ЗАМЕР [дочитка в простое] ${String(preload.ms)} мс: чанков ${String(preload.files)}, ${kb(preload.bytes)}`
    );

    // «Сервер остановили»: с этого момента ни один файл плагинов не отдаётся.
    const asked: string[] = [];
    await page.route('**/plugins/**', (route) => {
      asked.push(new URL(route.request().url()).pathname);
      return route.abort();
    });

    await builder.openFile('package.json');
    const editor = page
      .locator('[data-rb-plugin="reformer.editor-monaco"] .monaco-editor')
      .filter({ visible: true })
      .first();

    // Движок редактора — четыре с половиной мегабайта отложенного кода — уже в памяти:
    // первый открытый файл не ждёт сети и не зависит от неё.
    await expect(editor).toBeVisible();
    await expect(editor.locator('.view-lines')).toContainText('reformer-builder-playground');
    expect(asked).toEqual([]);
  });
});

test.describe('Повторный запуск собранного билдера', () => {
  test.skip(
    process.env.BUILDER_E2E_TARGET !== 'dist',
    'кэш файлов плагинов — свойство лаунчера, под dev-сервером его нет'
  );

  test('файлы плагинов не передаются заново: лаунчер отвечает «не изменился»', async ({
    builder,
    page,
  }) => {
    await builder.goto();
    await startupReport(page);

    // Оболочка спрашивает файлы плагинов с `no-cache` — на каждый запуск. Ответ лаунчера
    // с меткой версии превращает этот вопрос в пустой 304: тело берётся из кэша браузера.
    await page.reload();
    await startupReport(page);
    const plugins = await page.evaluate(() => {
      const entries = (
        performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      ).filter((entry) => new URL(entry.name).pathname.includes('/plugins/'));
      return {
        files: entries.length,
        transferred: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
        decoded: entries.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      };
    });
    console.log(
      `ЗАМЕР [повторный запуск] плагины: ${String(plugins.files)} файлов, ` +
        `по сети ${kb(plugins.transferred)} из ${kb(plugins.decoded)}`
    );

    expect(plugins.files).toBeGreaterThan(10);
    // По сети идут только заголовки: десятки килобайт на все файлы против мегабайтов тел.
    expect(plugins.transferred).toBeLessThan(plugins.decoded / 10);
  });
});
