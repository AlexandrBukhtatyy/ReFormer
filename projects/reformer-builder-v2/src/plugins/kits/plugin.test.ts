import { describe, expect, it } from 'vitest';

import type { CatalogJson } from '@/lib/catalog/types';
import { PaletteItemsPoint, type Disposable, type PluginContext, type WhenContext } from '@/sdk';
import type { KitsSettings } from './host';
import {
  createKitPaletteProvider,
  createKitsPlugin,
  KITS_PALETTE_PROVIDER_ID,
  KITS_PLUGIN_ID,
} from './plugin';
import { KITS_MESSAGES } from './messages';
import { createKitsService, KIT_SETTINGS_KEY, KitsServiceToken, type KitSource } from './service';

function kit(id: string, label: string, component: string): KitSource {
  const catalog: CatalogJson = {
    version: '2.0',
    kit: { id, label, package: `@vendor/${id}`, version: '1.2.3' },
    components: [{ name: component, role: 'field', propsSchema: { type: 'object' } }],
  };
  return { catalog };
}

const KIT_A = kit('kit-a', 'Кит А', 'Alpha');
const KIT_B = kit('kit-b', 'Кит Б', 'Beta');

/** Нейтральный контекст применимости: поставщику пунктов китов он безразличен. */
const NEUTRAL: WhenContext = {
  focus: 'none',
  activeEditorId: null,
  activeResourceKind: null,
  hasSelection: false,
  previewMode: null,
};

/** Перевод-заглушка: ключ и параметры видны в результате, словарь для этого не нужен. */
const translate = (key: string, params?: Record<string, unknown>): string =>
  params === undefined ? key : `${key}(${Object.values(params).join(' ')})`;

/** Настройки в объёме порта. Умолчания и записи видно снаружи — это и проверяется. */
function fakeSettings(): KitsSettings & { defaults: Map<string, unknown> } {
  const defaults = new Map<string, unknown>();
  return {
    defaults,
    get: <T>(key: string): T | undefined => defaults.get(key) as T | undefined,
    set: (): Promise<void> => Promise.resolve(),
    registerDefault<T>(key: string, value: T): Disposable {
      defaults.set(key, value);
      return {
        dispose(): void {
          defaults.delete(key);
        },
      };
    },
    onDidChange: (): Disposable => ({ dispose: (): void => {} }),
  };
}

/** Контекст плагина в объёме, который нужен активации: сервисы, вклады и список подписок. */
function fakeContext(): {
  ctx: PluginContext;
  services: Map<string, unknown>;
  contributed: { point: string; id: string | undefined; value: unknown }[];
} {
  const services = new Map<string, unknown>();
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const ctx = {
    id: KITS_PLUGIN_ID,
    subscriptions: [],
    services: {
      register: (token: { id: string }, impl: unknown) => {
        services.set(token.id, impl);
        return {
          dispose: () => {
            services.delete(token.id);
          },
        };
      },
      get: (token: { id: string }) => services.get(token.id),
    },
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id, value });
        return { dispose: () => {} };
      },
    },
  } as unknown as PluginContext;
  return { ctx, services, contributed };
}

describe('плагин', () => {
  it('идентификатор плагина — пространство имён во всех реестрах', () => {
    expect(createKitsPlugin({ translate }).id).toBe(KITS_PLUGIN_ID);
  });

  it('регистрирует сервис под токеном: у «какой кит активен» один ответ на всех', () => {
    const plugin = createKitsPlugin({ translate, sources: [KIT_A, KIT_B] });
    const { ctx, services } = fakeContext();

    plugin.activate(ctx);

    const kits = services.get(KitsServiceToken.id) as { activeId(): string } | undefined;
    expect(kits?.activeId()).toBe('kit-a');
  });

  it('объявляет умолчание настройки — встроенный кит', () => {
    const settings = fakeSettings();
    const plugin = createKitsPlugin({ translate, settings, sources: [KIT_A, KIT_B] });
    const { ctx } = fakeContext();

    plugin.activate(ctx);

    expect(settings.defaults.get(KIT_SETTINGS_KEY)).toBe('kit-a');
  });

  it('вносит поставщика пунктов палитры', () => {
    const plugin = createKitsPlugin({ translate, sources: [KIT_A] });
    const { ctx, contributed } = fakeContext();

    plugin.activate(ctx);

    expect(contributed).toEqual([
      { point: PaletteItemsPoint.id, id: KITS_PALETTE_PROVIDER_ID, value: expect.anything() },
    ]);
  });

  it('всё снятое кладётся в подписки: сервис, умолчание, пункты и подписка на настройки', () => {
    const plugin = createKitsPlugin({ translate, settings: fakeSettings(), sources: [KIT_A] });
    const { ctx, services } = fakeContext();

    plugin.activate(ctx);
    expect(ctx.subscriptions).toHaveLength(4);

    for (const subscription of ctx.subscriptions) subscription.dispose();
    expect(services.has(KitsServiceToken.id)).toBe(false);
  });

  it('без настроек умолчание не объявляется, но плагин работает', () => {
    const plugin = createKitsPlugin({ translate, sources: [KIT_A] });
    const { ctx } = fakeContext();

    plugin.activate(ctx);

    expect(ctx.subscriptions).toHaveLength(3);
  });
});

describe('пункты палитры', () => {
  it('по пункту на кит, заголовок — название кита, а не ключ словаря', () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const provider = createKitPaletteProvider(kits, translate);

    expect(provider.provide('', NEUTRAL)).toEqual([
      {
        id: 'kits.use.kit-a',
        title: 'palette.switch(Кит А)',
        detail: 'palette.active',
        run: expect.any(Function),
      },
      {
        id: 'kits.use.kit-b',
        title: 'palette.switch(Кит Б)',
        detail: 'palette.detail(@vendor/kit-b 1.2.3)',
        run: expect.any(Function),
      },
    ]);
  });

  it('запуск пункта переключает кит без перезагрузки страницы', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const provider = createKitPaletteProvider(kits, translate);

    const items = await provider.provide('', NEUTRAL);
    await items[1]!.run();

    expect(kits.activeId()).toBe('kit-b');
    expect(kits.catalog().map((entry) => entry.name)).toContain('Beta');
  });

  it('подпись активного кита пересчитывается после переключения', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const provider = createKitPaletteProvider(kits, translate);

    await kits.activate('kit-b');

    const items = await provider.provide('', NEUTRAL);
    expect(items[0]!.detail).toBe('palette.detail(@vendor/kit-a 1.2.3)');
    expect(items[1]!.detail).toBe('palette.active');
  });
});

describe('словарь', () => {
  it('везёт плагин, и обе локали покрывают одни и те же ключи', () => {
    const ru = Object.keys(KITS_MESSAGES.ru!).sort();
    const en = Object.keys(KITS_MESSAGES.en!).sort();

    expect(ru).toEqual(en);
    expect(ru).toContain('palette.switch');
  });
});

describe('настройки приходят из реестра сервисов — путь внешнего плагина', () => {
  it('плагин находит настройки сам, без параметра', () => {
    // Единственный путь, доступный плагину ИЗ КАТАЛОГА: композиция о нём не знает
    // и передать ему ничего не может. Пока встроенные получали настройки параметром,
    // путь оставался непроверенным — а другого у внешнего нет.
    const { ctx, services } = fakeContext();
    const settings = fakeSettings();
    services.set('host.settings', settings);

    createKitsPlugin({ translate: (k) => k }).activate?.(ctx);

    expect(settings.defaults.has(KIT_SETTINGS_KEY)).toBe(true);
  });

  it('без службы настроек плагин работает: выбор просто не переживёт перезагрузку', () => {
    // Деградация, а не отказ: у службы могло отказать хранилище.
    const { ctx, services } = fakeContext();

    expect(() => createKitsPlugin({ translate: (k) => k }).activate?.(ctx)).not.toThrow();
    expect(services.get('kits.active')).toBeDefined();
  });

  it('параметр перебивает реестр: он остался только для тестов', () => {
    const { ctx, services } = fakeContext();
    const byParam = fakeSettings();
    const byRegistry = fakeSettings();
    services.set('host.settings', byRegistry);

    createKitsPlugin({ translate: (k) => k, settings: byParam }).activate?.(ctx);

    expect(byParam.defaults.has(KIT_SETTINGS_KEY)).toBe(true);
    expect(byRegistry.defaults.has(KIT_SETTINGS_KEY)).toBe(false);
  });
});
