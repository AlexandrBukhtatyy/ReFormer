/**
 * Платформа форм поверх встроенных — настоящим `boot`, БЕЗ единого движка.
 *
 * Киты и превью-хост нужны обоим движкам (ReFormer и RJSF) и не знают ни одного из них. На этом
 * держится ось движков: второй движок приносит свои плагины и не правит платформу. Проверяется,
 * что платформа встаёт сама по себе — и что без движка она честно говорит «показывать нечем»,
 * а не отказывает.
 *
 * Раньше эти утверждения жили в тесте основы билдера: превью-хост был встроенным. Теперь оба
 * плагина едут слоем плагинов приложения, а стенд собирает их поверх встроенных тем же способом.
 *
 * @module plugins/forms/integration/forms-platform.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import type {
  ExtensionPoint,
  KitsService,
  PreviewLiveService,
} from '@reformer/builder-plugin-api/internal';
import {
  definePlugin,
  DocumentModelPoint,
  KitsCapability,
  PaletteItemsPoint,
  PanelPoint,
  PreviewLiveCapability,
  PreviewSurfacePoint,
  ValidatorPoint,
} from '@reformer/builder-plugin-api/internal';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';
import { KITS_CELL_ID, KITS_PLUGIN_ID } from '../kits/src';
import { formsApplication } from './application';

/** Окружение браузера в объёме, который трогает `boot` при сборке. */
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
  app = boot({ application: formsApplication() });
  await app.ready;
  return app;
}

/** Спрашивает ПЛАГИН — тем же путём, каким спросит редактор движка. */
function probe(started: BuilderApp): {
  readonly live: PreviewLiveService | undefined;
  readonly kits: KitsService | undefined;
} {
  let live: PreviewLiveService | undefined;
  let kits: KitsService | undefined;
  started.plugins.register(
    definePlugin({
      id: 'probe',
      activate(ctx) {
        live = ctx.services.get(PreviewLiveCapability);
        kits = ctx.services.get(KitsCapability);
      },
    }),
    []
  );
  expect(started.plugins.activate('probe')).toBe(true);
  return { live, kits };
}

describe('boot с платформой форм и без движка', () => {
  it('поднимается: встроенные, киты и превью-хост — все активны', async () => {
    const started = await start();

    const statuses = started.plugins.statuses();
    expect(statuses.map((s) => s.id).sort()).toEqual([
      'reformer.editor-markdown',
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.kits',
      'reformer.plugin-manager',
      'reformer.preview',
      'reformer.profile-switch',
      'reformer.project',
    ]);
    expect(statuses.filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('вкладов движка нет: ни поверхностей, ни модели схемы, ни валидатора', async () => {
    const started = await start();
    const owners = <T>(point: ExtensionPoint<T>): string[] =>
      [...new Set(started.extensions.get(point).map((c) => c.pluginId))].sort();

    // Чем рисовать схему — знание движка: хост превью поверхностей не вносит.
    expect(owners(PreviewSurfacePoint)).toEqual([]);
    expect(owners(DocumentModelPoint)).toEqual([]);
    expect(owners(ValidatorPoint)).toEqual([]);
  });

  it('живой вид есть и честно говорит, что показывать нечем', async () => {
    const { live } = probe(await start());

    // Вид существует, а не отсутствует: редактор движка найдёт его и внесёт свою поверхность.
    expect(live).toBeDefined();
    expect(live?.available()).toBe(false);
    expect(live?.chosen('mem:form.json')).toBeNull();
  });

  it('служба китов есть, и переключатель кита приходит вместе с ней — ячейкой и палитрой', async () => {
    const started = await start();

    expect(probe(started).kits?.activeId()).toBeDefined();
    // Выбор кита принадлежит плагину китов, а не встроенному выбору профиля: состав без форм
    // остаётся без ячейки кита, а не с пустой.
    const cells = started.extensions
      .get(PanelPoint)
      .filter((contribution) => contribution.value.slot === 'statusbar')
      .map((contribution) => `${contribution.pluginId}:${contribution.value.id}`);
    expect(cells).toContain(`${KITS_PLUGIN_ID}:${KITS_CELL_ID}`);
    expect(
      started.extensions.get(PaletteItemsPoint).map((contribution) => contribution.pluginId)
    ).toContain(KITS_PLUGIN_ID);
  });
});
