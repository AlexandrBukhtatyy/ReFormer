/**
 * Оболочка поднимается на КОРОТКОМ составе — и это не то же самое, что «состав собрался».
 *
 * `compose.test` отвечает на вопрос «кого создали»: там плагины собираются на портах-пустышках
 * и в реестр оболочки не попадают. Здесь поднимается настоящий `boot`: настоящие порты,
 * настоящие службы, настоящая последовательность запуска. Вопрос другой — переживёт ли
 * оболочка отсутствие плагина, которого она никогда не видела отсутствующим.
 *
 * Вопрос не праздный. `boot` до сих пор берёт из плагинов четыре значения (тело Monaco,
 * токен китов, словарь и идентификатор файлов) и собирает порты для ВСЕХ встроенных, включая
 * тех, кого профиль не назвал. Порт без потребителя обязан оставаться
 * безвредным — иначе «минимальный профиль» означал бы правку оболочки, то есть ровно то,
 * ради отмены чего заведены профили.
 *
 * Каталог `integration/` — единственное место оболочки, которому разрешено импортировать
 * `@/application` (исключение прописано в eslint.config.js): проверяется здесь собранное
 * приложение, а оно по определению знает свой состав.
 *
 * @module shell/boot/integration/minimal-profile.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { minimalProfile } from '@/application/profiles/presets';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import type { ExtensionPoint } from '@reformer/builder-plugin-api/internal';
import { EditorPoint } from '@/shell/platform/ui/contributions/editors';
import { PanelPoint } from '@/shell/platform/ui/slots';
import { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

/**
 * Окружение браузера в объёме, который трогает `boot` при сборке.
 *
 * Двойники, а не jsdom: прогон узловой, и полноценный DOM ради трёх обращений
 * (`document.title`, класс темы на корне, подписка на фокус окна) стоил бы дороже, чем даёт.
 * IndexedDB — настоящий двойник из платформы: без него настройки не загрузились бы,
 * а `ready` завершился бы веткой отказа, то есть до активации плагинов дело не дошло бы.
 */
function stubBrowser(): void {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners });
  vi.stubGlobal('document', {
    ...listeners,
    title: 'reformer-builder',
    documentElement: { classList: { add: () => {}, remove: () => {} } },
  });
}

let app: BuilderApp | null = null;

afterEach(() => {
  app?.dispose();
  app = null;
  vi.unstubAllGlobals();
});

describe('boot на профиле minimal', () => {
  async function start(): Promise<BuilderApp> {
    stubBrowser();
    app = boot({ application: fromProfile(minimalProfile) });
    await app.ready;
    return app;
  }

  it('приложение поднимается, и все три плагина активны', async () => {
    const started = await start();

    const statuses = started.plugins.statuses();
    expect(statuses.map((s) => s.id).sort()).toEqual([
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.validator-schema',
    ]);
    expect(statuses.filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('вкладов превью и редактора схемы в приложении НЕТ', async () => {
    const started = await start();
    const owners = <T>(point: ExtensionPoint<T>): string[] =>
      [...new Set(started.extensions.get(point).map((c) => c.pluginId))].sort();

    // Поимённо, а не «меньше, чем у полного»: порог прошёл бы и тогда, когда из состава
    // выпал не тот плагин.
    expect(owners(PanelPoint)).toEqual(['reformer.files']);
    expect(owners(EditorPoint)).toEqual(['reformer.editor-monaco', 'reformer.files']);
    // Модельных документов не вносит никто: структурная модель формы — вклад редактора схемы,
    // и без него `.json` открывается текстом. Это и есть обещанная деградация.
    expect(owners(DocumentModelPoint)).toEqual([]);
  });

  it('команды в приложении есть, и все они от троих', async () => {
    // Без этого проверка выше проходила бы и на приложении, которое вообще не поднялось.
    const started = await start();
    const commands = started.commands.getAll();

    expect(commands.length).toBeGreaterThanOrEqual(3);
    const foreign = commands
      .filter((c) => c.pluginId !== undefined)
      .filter(
        (c) =>
          !['reformer.files', 'reformer.editor-monaco', 'reformer.validator-schema'].includes(
            c.pluginId as string
          )
      );
    expect(foreign.map((c) => c.id)).toEqual([]);
  });
});
