/**
 * Основа конструктора (`builder.base`) поднимается БЕЗ единого плагина стека.
 *
 * Это утверждение, на котором держится вся ось стеков: второй стек собирается профилем
 * `extends: 'builder.base'`, и если основа без стека ReFormer не встаёт — второй стек начинался
 * бы с правки основы. Проверяется настоящий `boot` с настоящими портами и службами.
 *
 * Платформы форм в основе НЕТ вовсе: ни китов, ни превью-хоста — они плагины приложения
 * (домен `forms` образца). Живой вид поэтому отсутствует, и редактор стека обязан пережить
 * это как названную деградацию; что он получает, когда платформа форм есть, проверяет стенд
 * домена (`forms/integration/forms-platform.test`).
 *
 * @module shell/boot/integration/base-profile.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { builtinProfile } from '@/application/profiles/registry';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import type { ExtensionPoint, PreviewLiveService } from '@reformer/builder-plugin-api/internal';
import {
  definePlugin,
  DocumentModelPoint,
  EditorPoint,
  PanelPoint,
  PreviewLiveCapability,
  PreviewSurfacePoint,
  ValidatorPoint,
} from '@reformer/builder-plugin-api/internal';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

const baseProfile = builtinProfile('builder.base');

/** Окружение браузера в объёме, который трогает `boot` при сборке (см. `minimal-profile.test`). */
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

async function start(): Promise<BuilderApp> {
  stubBrowser();
  app = boot({ application: fromProfile(baseProfile) });
  await app.ready;
  return app;
}

describe('boot на профиле builder.base', () => {
  it('поднимается, и все плагины основы активны', async () => {
    const started = await start();

    const statuses = started.plugins.statuses();
    expect(statuses.map((s) => s.id).sort()).toEqual([
      'reformer.plugin-manager',
      'reformer.profile-switch',
      'reformer.project',
    ]);
    expect(statuses.filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('вкладов стека нет: ни поверхностей, ни модели схемы, ни валидатора', async () => {
    const started = await start();
    const owners = <T>(point: ExtensionPoint<T>): string[] =>
      [...new Set(started.extensions.get(point).map((c) => c.pluginId))].sort();

    expect(owners(PreviewSurfacePoint)).toEqual([]);
    expect(owners(DocumentModelPoint)).toEqual([]);
    expect(owners(ValidatorPoint)).toEqual([]);
    // Панель модели формы — вклад стека; у основы панели только свои: ячейка выбора профиля
    // в строке состояния и стартовая страница. Дерево файлов и панель проблем — плагин приложения.
    expect(owners(PanelPoint)).toEqual(['reformer.profile-switch', 'reformer.project']);
    // Редакторов в основе нет: редактор кода — плагин приложения, как дерево файлов.
    expect(owners(EditorPoint)).toEqual([]);
  });

  it('живого вида в основе нет: превью-хост — плагин приложения, а не встроенный', async () => {
    const started = await start();
    // Спрашивает ПЛАГИН — тем же путём, каким спросит редактор стека: возможность
    // необязательная, и её отсутствие — названная деградация, а не отказ.
    let live: PreviewLiveService | undefined;
    started.plugins.register(
      definePlugin({
        id: 'probe',
        activate(ctx) {
          live = ctx.services.get(PreviewLiveCapability);
        },
      }),
      []
    );
    expect(started.plugins.activate('probe')).toBe(true);

    expect(live).toBeUndefined();
  });
});
