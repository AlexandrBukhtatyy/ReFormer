import { describe, expect, it, vi } from 'vitest';

import {
  KitsCapability,
  KitSourcePoint,
  PaletteItemsPoint,
  type CatalogJson,
  type Disposable,
  type KitSource,
  type KitsService,
  type PluginContext,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import type { KitsSettings } from './host';
import {
  createKitPaletteProvider,
  createKitsPlugin,
  KITS_PALETTE_PROVIDER_ID,
  KITS_PLUGIN_ID,
} from './plugin';
import { KITS_MESSAGES } from './messages';
import { createKitsService, KIT_SETTINGS_KEY } from './service';

function kit(id: string, label: string, component: string): KitSource {
  const catalog: CatalogJson = {
    version: '2.1',
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

interface FakeContribution {
  readonly id: string;
  readonly pluginId: string;
  readonly order: number;
  readonly value: unknown;
}

/**
 * Контекст плагина в объёме, который нужен активации: службы, вклады, наблюдение за точкой
 * источников китов и список подписок. Кит «вносит» другой плагин — {@link contributeKit}.
 */
function fakeContext() {
  const services = new Map<string, unknown>();
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const sources: FakeContribution[] = [];
  const observers = new Set<() => void>();
  /** Словарь, внесённый плагином: локаль → ключ → текст. */
  const dictionary = new Map<string, Readonly<Record<string, string>>>();
  const ctx = {
    id: KITS_PLUGIN_ID,
    subscriptions: [],
    i18n: {
      contribute: (locale: string, messages: Readonly<Record<string, string>>) => {
        dictionary.set(locale, { ...dictionary.get(locale), ...messages });
      },
      t: (key: string) => dictionary.get('ru')?.[key] ?? `⟦${key}⟧`,
    },
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
      get: (point: { id: string }) => (point.id === KitSourcePoint.id ? [...sources] : []),
      observe: (point: { id: string }, cb: () => void) => {
        if (point.id === KitSourcePoint.id) observers.add(cb);
        return { dispose: () => observers.delete(cb) };
      },
    },
  } as unknown as PluginContext;

  /** Как `contribute` чужого плагина: вклад появился, наблюдатели точки узнали сразу. */
  const contributeKit = (pluginId: string, value: unknown): Disposable => {
    const contribution = { id: `${pluginId}#${sources.length}`, pluginId, order: 0, value };
    sources.push(contribution);
    for (const observer of [...observers]) observer();
    return {
      dispose: () => {
        sources.splice(sources.indexOf(contribution), 1);
        for (const observer of [...observers]) observer();
      },
    };
  };

  const kits = (): KitsService => services.get(KitsCapability.id) as KitsService;
  return { ctx, services, contributed, contributeKit, kits, dictionary };
}

describe('плагин', () => {
  it('идентификатор плагина — пространство имён во всех реестрах', () => {
    expect(createKitsPlugin({}).id).toBe(KITS_PLUGIN_ID);
  });

  it('регистрирует службу под возможностью SDK: у «какой кит активен» один ответ на всех', () => {
    const { ctx, kits } = fakeContext();

    createKitsPlugin({ sources: [KIT_A, KIT_B] }).activate(ctx);

    expect(kits().activeId()).toBe('kit-a');
  });

  it('объявляет умолчание настройки — первый встроенный кит', () => {
    const settings = fakeSettings();
    const { ctx } = fakeContext();

    createKitsPlugin({ settings, sources: [KIT_A, KIT_B] }).activate(ctx);

    expect(settings.defaults.get(KIT_SETTINGS_KEY)).toBe('kit-a');
  });

  it('вносит свой словарь: пункты палитры переводятся им, а не маркером промаха', () => {
    const { ctx, contributed, dictionary } = fakeContext();

    createKitsPlugin({ sources: [KIT_A] }).activate(ctx);

    expect(dictionary.get('ru')).toEqual(KITS_MESSAGES.ru);
    expect(dictionary.get('en')).toEqual(KITS_MESSAGES.en);
    const provider = contributed.find((entry) => entry.point === PaletteItemsPoint.id)?.value as {
      provide(context: WhenContext): readonly { title: string }[];
    };
    expect(provider.provide(NEUTRAL)[0]?.title).not.toContain('⟦');
  });

  it('вносит поставщика пунктов палитры', () => {
    const { ctx, contributed } = fakeContext();

    createKitsPlugin({ sources: [KIT_A] }).activate(ctx);

    expect(contributed).toEqual([
      { point: PaletteItemsPoint.id, id: KITS_PALETTE_PROVIDER_ID, value: expect.anything() },
    ]);
  });

  it('всё снятое кладётся в подписки: служба, умолчание, наблюдение, пункты и сама служба', () => {
    const { ctx, services } = fakeContext();

    createKitsPlugin({ settings: fakeSettings(), sources: [KIT_A] }).activate(ctx);
    expect(ctx.subscriptions).toHaveLength(5);

    for (const subscription of ctx.subscriptions) subscription.dispose();
    expect(services.has(KitsCapability.id)).toBe(false);
  });

  it('без настроек умолчание не объявляется, но плагин работает', () => {
    const { ctx } = fakeContext();

    createKitsPlugin({ sources: [KIT_A] }).activate(ctx);

    expect(ctx.subscriptions).toHaveLength(4);
  });
});

describe('киты из точки reformer.kit.source', () => {
  it('кит, внесённый ДО активации реестра, в списке сразу: порядок активации незначим', () => {
    const { ctx, contributeKit, kits } = fakeContext();
    contributeKit('kit-hexa-ui', kit('hexa', 'HexaUI', 'Hexa'));

    createKitsPlugin({ sources: [KIT_A] }).activate(ctx);

    expect(
      kits()
        .available()
        .map((summary) => summary.id)
    ).toEqual(['kit-a', 'hexa']);
  });

  it('кит, внесённый ПОСЛЕ активации, подхватывается, а снятый — уходит', () => {
    const { ctx, contributeKit, kits } = fakeContext();
    createKitsPlugin({ sources: [KIT_A] }).activate(ctx);

    const contribution = contributeKit('kit-hexa-ui', kit('hexa', 'HexaUI', 'Hexa'));
    expect(
      kits()
        .available()
        .map(({ id, origin }) => ({ id, origin }))
    ).toEqual([
      { id: 'kit-a', origin: { kind: 'builtin' } },
      { id: 'hexa', origin: { kind: 'plugin', pluginId: 'kit-hexa-ui' } },
    ]);

    contribution.dispose();
    expect(
      kits()
        .available()
        .map((summary) => summary.id)
    ).toEqual(['kit-a']);
  });

  it('отказ приходит уведомлением из словаря плагина', () => {
    const { ctx, services, contributeKit } = fakeContext();
    const warning = vi.fn();
    services.set('reformer.notifications', { warning });
    createKitsPlugin({ sources: [KIT_A] }).activate(ctx);

    contributeKit('impostor', kit('kit-a', 'Самозванец', 'X'));

    expect(warning).toHaveBeenCalledWith(`${KITS_PLUGIN_ID}:problem.duplicate`, {
      params: { plugin: 'impostor', kit: 'kit-a', detail: '' },
    });
  });

  it('сбой разбора состава не выходит наружу: наблюдатель зовётся внутри чужого contribute', () => {
    const { ctx, contributeKit, kits } = fakeContext();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    createKitsPlugin({ sources: [KIT_A] }).activate(ctx);

    expect(() => contributeKit('broken', null)).not.toThrow();
    expect(error).toHaveBeenCalled();
    expect(kits().activeId()).toBe('kit-a');
    error.mockRestore();
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
    expect(kits.catalogJson().components.map((record) => record.name)).toEqual(['Beta']);
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

  it('на каждый отказ принять кит есть сообщение', () => {
    for (const code of ['no-id', 'duplicate', 'invalid-catalog', 'mismatch', 'load-failed']) {
      expect(KITS_MESSAGES.ru![`problem.${code}`]).toBeDefined();
    }
  });
});

describe('настройки приходят из реестра служб — путь внешнего плагина', () => {
  it('плагин находит настройки сам, без параметра', () => {
    // Единственный путь, доступный плагину ИЗ КАТАЛОГА: композиция о нём не знает
    // и передать ему ничего не может.
    const { ctx, services } = fakeContext();
    const settings = fakeSettings();
    services.set('reformer.settings', settings);

    createKitsPlugin({}).activate?.(ctx);

    expect(settings.defaults.has(KIT_SETTINGS_KEY)).toBe(true);
  });

  it('без службы настроек плагин работает: выбор просто не переживёт перезагрузку', () => {
    // Деградация, а не отказ: у службы могло отказать хранилище.
    const { ctx, services } = fakeContext();

    expect(() => createKitsPlugin({}).activate?.(ctx)).not.toThrow();
    expect(services.get('reformer.kit.catalog')).toBeDefined();
  });

  it('параметр перебивает реестр: он остался только для тестов', () => {
    const { ctx, services } = fakeContext();
    const byParam = fakeSettings();
    const byRegistry = fakeSettings();
    services.set('reformer.settings', byRegistry);

    createKitsPlugin({ settings: byParam }).activate?.(ctx);

    expect(byParam.defaults.has(KIT_SETTINGS_KEY)).toBe(true);
    expect(byRegistry.defaults.has(KIT_SETTINGS_KEY)).toBe(false);
  });
});
