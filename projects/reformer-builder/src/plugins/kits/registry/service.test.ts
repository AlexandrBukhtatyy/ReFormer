import { describe, expect, it, vi } from 'vitest';

import {
  KitsCapability,
  type CatalogJson,
  type Disposable,
  type KitNamespace,
  type KitSource,
} from '@reformer/builder-plugin-api';
import type { CatalogValidator } from '@reformer/builder-plugin-api/tooling';
import { BUILTIN_KIT } from './builtin';
import type { KitsSettings } from './host';
import {
  createKitsService,
  KIT_SETTINGS_KEY,
  type ContributedKit,
  type KitProblem,
  type KitsServiceOptions,
} from './service';

/** Кит из одного поля — достаточно, чтобы отличить один каталог от другого. */
function catalogOf(id: string, label: string, component: string): CatalogJson {
  return {
    version: '2.1',
    kit: { id, label, package: `@vendor/${id}`, version: '1.2.3' },
    components: [{ name: component, role: 'field', propsSchema: { type: 'object' } }],
  };
}

function kit(id: string, label: string, component: string): KitSource {
  return { catalog: catalogOf(id, label, component) };
}

/**
 * Настройки в объёме порта: та же семантика, что у настоящей службы (запись видна сразу,
 * подписчик узнаёт о смене действующего значения).
 */
function fakeSettings(seed: Record<string, unknown> = {}): KitsSettings & {
  written: [string, unknown][];
  fail: (error: Error) => void;
} {
  const data = new Map(Object.entries(seed));
  const defaults = new Map<string, unknown>();
  const listeners = new Set<(key: string) => void>();
  const written: [string, unknown][] = [];
  let failure: Error | null = null;

  return {
    written,
    fail(error) {
      failure = error;
    },
    get<T>(key: string): T | undefined {
      return (data.has(key) ? data.get(key) : defaults.get(key)) as T | undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      written.push([key, value]);
      if (failure !== null) throw failure;
      data.set(key, value);
      for (const listener of [...listeners]) listener(key);
    },
    registerDefault<T>(key: string, value: T): Disposable {
      defaults.set(key, value);
      return {
        dispose(): void {
          defaults.delete(key);
        },
      };
    },
    onDidChange(cb: (key: string) => void): Disposable {
      listeners.add(cb);
      return {
        dispose(): void {
          listeners.delete(cb);
        },
      };
    },
  };
}

const KIT_A = kit('kit-a', 'Кит А', 'Alpha');
const KIT_B = kit('kit-b', 'Кит Б', 'Beta');
const BUILTIN = { kind: 'builtin' } as const;

const names = (json: CatalogJson): string[] => json.components.map((record) => record.name);

describe('состав службы', () => {
  it('возможность — из SDK, мажор 2: служба нейтральна и отдаёт сырой каталог', () => {
    expect(KitsCapability.id).toBe('reformer.kit.catalog');
    expect(KitsCapability.version).toBe('2.0.0');
  });

  it('без китов службы не бывает: делать активным нечего', () => {
    expect(() => createKitsService({ sources: [] })).toThrow(/пуст/u);
  });

  it('два встроенных кита под одним идентификатором — отказ, а не молчаливая замена', () => {
    expect(() => createKitsService({ sources: [KIT_A, kit('kit-a', 'Двойник', 'Gamma')] })).toThrow(
      /дважды/u
    );
  });

  it('встроенный кит обязан себя назвать: идентификатор — ключ выбора', () => {
    expect(() =>
      createKitsService({ sources: [{ catalog: () => Promise.resolve(catalogOf('x', 'X', 'X')) }] })
    ).toThrow(/не назвал/u);
  });

  it('первый встроенный кит — умолчание и активный, пока не выбрано иное', () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    expect(kits.defaultId).toBe('kit-a');
    expect(kits.activeId()).toBe('kit-a');
    expect(kits.activeOrigin()).toEqual(BUILTIN);
  });

  it('список доступных отвечает и на «между чем выбирать», и на «что включено»', () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    expect(kits.available()).toEqual([
      {
        id: 'kit-a',
        label: 'Кит А',
        package: '@vendor/kit-a',
        version: '1.2.3',
        active: true,
        origin: BUILTIN,
      },
      {
        id: 'kit-b',
        label: 'Кит Б',
        package: '@vendor/kit-b',
        version: '1.2.3',
        active: false,
        origin: BUILTIN,
      },
    ]);
  });
});

describe('активный кит', () => {
  it('каталог и дескриптор — активного кита, а не первого попавшегося', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    expect(names(kits.catalogJson())).toEqual(['Alpha']);
    expect(kits.descriptor().id).toBe('kit-a');

    await kits.activate('kit-b');

    expect(names(kits.catalogJson())).toEqual(['Beta']);
    expect(kits.descriptor().id).toBe('kit-b');
  });

  it('каталог отдаётся таким, каким его поставил кит: синтетика — дело стека', () => {
    const kits = createKitsService({ sources: [KIT_A] });

    // Служба нейтральна: записи палитры ReFormer (`$html`, `FormArray`) добавляет его проекция.
    expect(names(kits.catalogJson())).not.toContain('FormArray');
  });

  it('снимки стабильны между сменами и обновляются вместе с китом', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    const catalog = kits.catalogJson();
    const descriptor = kits.descriptor();
    expect(kits.catalogJson()).toBe(catalog);
    expect(kits.descriptor()).toBe(descriptor);
    expect(kits.available()).toBe(kits.available());

    await kits.activate('kit-b');

    expect(kits.catalogJson()).not.toBe(catalog);
    expect(kits.descriptor()).not.toBe(descriptor);
  });

  it('возврат к прежнему киту отдаёт ТЕ ЖЕ объекты: пересобирать нечего', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const catalog = kits.catalogJson();
    const descriptor = kits.descriptor();

    await kits.activate('kit-b');
    await kits.activate('kit-a');

    expect(kits.catalogJson()).toBe(catalog);
    expect(kits.descriptor()).toBe(descriptor);
  });

  it('неизвестный кит активировать нельзя: каталога для него никто не поставил', async () => {
    const kits = createKitsService({ sources: [KIT_A] });

    await expect(kits.activate('kit-z')).rejects.toThrow(/не установлен/u);
    expect(kits.activeId()).toBe('kit-a');
  });
});

describe('подписчики', () => {
  it('смена кита уведомляет: превью и валидатор обязаны увидеть одно и то же значение', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const seen: string[] = [];
    kits.onDidChange(() => seen.push(kits.activeId()));

    await kits.activate('kit-b');

    expect(seen).toEqual(['kit-b']);
  });

  it('выбор того же кита ничего не уведомляет: перерисовка ради того же значения — трата кадра', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const cb = vi.fn();
    kits.onDidChange(cb);

    await kits.activate('kit-a');

    expect(cb).not.toHaveBeenCalled();
  });

  it('упавший подписчик не мешает остальным', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    kits.onDidChange(() => {
      throw new Error('подписчик упал');
    });
    kits.onDidChange(good);

    await kits.activate('kit-b');

    expect(good).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('снятая подписка больше не зовётся', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const cb = vi.fn();
    kits.onDidChange(cb).dispose();

    await kits.activate('kit-b');

    expect(cb).not.toHaveBeenCalled();
  });
});

describe('выбор живёт в настройках', () => {
  it('сохранённый выбор поднимается на старте', () => {
    const settings = fakeSettings({ [KIT_SETTINGS_KEY]: 'kit-b' });
    const kits = createKitsService({ sources: [KIT_A, KIT_B], settings });

    expect(kits.activeId()).toBe('kit-b');
  });

  it('переключение пишет выбор', async () => {
    const settings = fakeSettings();
    const kits = createKitsService({ sources: [KIT_A, KIT_B], settings });

    await kits.activate('kit-b');

    expect(settings.written).toEqual([[KIT_SETTINGS_KEY, 'kit-b']]);
  });

  it('кит стал активен сразу, не дожидаясь хранилища', () => {
    const settings = fakeSettings();
    const kits = createKitsService({ sources: [KIT_A, KIT_B], settings });

    const pending = kits.activate('kit-b');

    expect(kits.activeId()).toBe('kit-b');
    return pending;
  });

  it('незнакомый идентификатор в настройках не затирается: кит могли временно выключить', () => {
    const settings = fakeSettings({ [KIT_SETTINGS_KEY]: 'kit-ушедший' });
    const kits = createKitsService({ sources: [KIT_A], settings });

    expect(kits.activeId()).toBe('kit-a');
    expect(settings.written).toEqual([]);
  });

  it('мусор в настройках — то же самое: открываемся на умолчании', () => {
    const settings = fakeSettings({ [KIT_SETTINGS_KEY]: 42 });
    const kits = createKitsService({ sources: [KIT_A], settings });

    expect(kits.activeId()).toBe('kit-a');
  });

  it('правка настройки МИМО службы меняет активный кит', async () => {
    const settings = fakeSettings();
    const kits = createKitsService({ sources: [KIT_A, KIT_B], settings });

    await settings.set(KIT_SETTINGS_KEY, 'kit-b');

    expect(kits.activeId()).toBe('kit-b');
  });

  it('чужой ключ настройки не трогает выбор', async () => {
    const settings = fakeSettings();
    const kits = createKitsService({ sources: [KIT_A, KIT_B], settings });

    await settings.set('host.locale', 'en');

    expect(kits.activeId()).toBe('kit-a');
  });

  it('без настроек служба работает: выбор просто не переживёт перезагрузку', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    await kits.activate('kit-b');

    expect(kits.activeId()).toBe('kit-b');
  });

  it('dispose снимает подписку на настройки', async () => {
    const settings = fakeSettings();
    const kits = createKitsService({ sources: [KIT_A, KIT_B], settings });

    kits.dispose();
    await settings.set(KIT_SETTINGS_KEY, 'kit-b');

    expect(kits.activeId()).toBe('kit-a');
  });
});

describe('встроенный кит', () => {
  it('представляется шапкой ещё до загрузки каталога', () => {
    const kits = createKitsService({ sources: [BUILTIN_KIT] });

    expect(kits.activeId()).toBe('reformer-ui-kit');
    expect(kits.descriptor().package).toBe('@reformer/ui-kit');
  });

  it('поставляется загрузчиком: 864 кБ каталога не место в главном чанке', () => {
    expect(typeof BUILTIN_KIT.catalog).toBe('function');
  });

  it('шапка совпадает с тем, что кит объявляет о себе в каталоге', async () => {
    const kits = createKitsService({ sources: [BUILTIN_KIT] });
    const before = kits.available();

    await kits.whenReady();

    expect(kits.available()).toEqual(before);
    const descriptor = kits.descriptor();
    expect(descriptor.id).toBe('reformer-ui-kit');
    expect(descriptor.label).toBe('ReFormer UI Kit');
    expect(descriptor.package).toBe('@reformer/ui-kit');
  });

  it('каталог не пуст и объявляет всё, что раньше достраивал билдер', async () => {
    const kits = createKitsService({ sources: [BUILTIN_KIT] });

    await kits.whenReady();

    expect(names(kits.catalogJson()).length).toBeGreaterThan(50);
    expect(names(kits.catalogJson())).toContain('Input');
    const descriptor = kits.descriptor();
    expect(descriptor.adapters.wizard).toEqual({ symbol: 'FormWizard' });
    expect(descriptor.infra.fieldFrame).toBe('FieldFrame');
    expect(descriptor.previewPolicy.get('Dialog')?.mode).toBe('limited');
  });

  it('словарь классов приезжает вместе с каталогом: до загрузки подсказывать нечем', async () => {
    const kits = createKitsService({ sources: [BUILTIN_KIT] });

    expect(kits.descriptor().styles.classNames).toEqual([]);

    await kits.whenReady();

    expect(kits.descriptor().styles.classNames.length).toBeGreaterThan(0);
  });
});

/**
 * Ленивый кит с управляемым моментом загрузки: тест решает, когда каталог «доехал», и потому
 * может проверить ОБА состояния — до и после, — а не только итоговое.
 */
function lazyKit(id: string, component: string, loaded = id) {
  const header = { id, label: `Кит ${id}`, package: `@vendor/${id}`, version: '1.2.3' };
  const json: CatalogJson = {
    version: '2.1',
    kit: { ...header, id: loaded },
    components: [{ name: component, role: 'field', propsSchema: { type: 'object' } }],
  };
  let calls = 0;
  let deliver!: (value: CatalogJson) => void;
  let refuse!: (error: unknown) => void;
  const arrival = new Promise<CatalogJson>((resolve, reject) => {
    deliver = resolve;
    refuse = reject;
  });
  const source: KitSource = {
    kit: header,
    catalog: () => {
      calls += 1;
      return arrival;
    },
  };
  return {
    source,
    calls: () => calls,
    deliver: () => {
      deliver(json);
    },
    refuse: () => {
      refuse(new Error('сеть отказала'));
    },
  };
}

describe('каталог приезжает позже кита', () => {
  it('список доступных готов до загрузки: выбирать можно, не скачав ни одного каталога', () => {
    const a = lazyKit('kit-a', 'Alpha');
    const b = lazyKit('kit-b', 'Beta');
    const kits = createKitsService({ sources: [a.source, b.source] });

    expect(kits.available().map(({ id, label, active }) => ({ id, label, active }))).toEqual([
      { id: 'kit-a', label: 'Кит kit-a', active: true },
      { id: 'kit-b', label: 'Кит kit-b', active: false },
    ]);
    expect(a.calls()).toBe(0);
    expect(b.calls()).toBe(0);
  });

  it('до загрузки каталог — шапка без записей', () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    expect(kits.catalogJson().components).toEqual([]);
    expect(kits.catalogJson().kit?.id).toBe('kit-a');
    expect(kits.descriptor().id).toBe('kit-a');
  });

  it('переход «пусто → загружено» доходит до подписчиков', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });
    const seen: string[][] = [];
    kits.onDidChange(() => seen.push(names(kits.catalogJson())));

    const ready = kits.whenReady();
    a.deliver();
    await ready;

    // Подписчика зовут ПОСЛЕ подстановки: перечитав, он видит новый каталог, а не старый.
    expect(seen).toEqual([['Alpha']]);
  });

  it('снимок стабилен по обе стороны загрузки и меняется ровно один раз', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    const before = kits.catalogJson();
    expect(kits.catalogJson()).toBe(before);

    const ready = kits.whenReady();
    a.deliver();
    await ready;

    const after = kits.catalogJson();
    expect(after).not.toBe(before);
    expect(kits.catalogJson()).toBe(after);
  });

  it('загрузчик зовут один раз, сколько бы ни спрашивали', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    kits.catalogJson();
    kits.descriptor();
    const ready = kits.whenReady();
    void kits.whenReady();
    a.deliver();
    await ready;
    kits.catalogJson();

    expect(a.calls()).toBe(1);
  });

  it('синхронное чтение само заводит загрузку: иначе каталог не приехал бы никогда', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    expect(kits.catalogJson().components).toEqual([]);
    expect(a.calls()).toBe(1);

    a.deliver();
    await kits.whenReady();

    expect(names(kits.catalogJson())).toEqual(['Alpha']);
  });

  it('отказ загрузки оставляет пустой каталог и не отвергает ожидание', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    const ready = kits.whenReady();
    a.refuse();
    await expect(ready).resolves.toBeUndefined();

    expect(kits.catalogJson().components).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('load-failed'));
    error.mockRestore();
  });

  it('сорвавшаяся загрузка не повторяется сама: читателя зовут на каждый кадр', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    const ready = kits.whenReady();
    a.refuse();
    await ready;

    kits.catalogJson();
    kits.catalogJson();
    await kits.whenReady();

    expect(a.calls()).toBe(1);
    error.mockRestore();
  });

  it('загруженный каталог с чужим идентификатором — отказ, а не подмена ключа выбора', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = lazyKit('kit-a', 'Alpha', 'kit-подменённый');
    const kits = createKitsService({ sources: [a.source] });

    const ready = kits.whenReady();
    a.deliver();
    await ready;

    expect(kits.activeId()).toBe('kit-a');
    expect(kits.catalogJson().components).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('mismatch'));
    error.mockRestore();
  });

  it('каталог без имени получает имя шапки: ключ выбора — объявленный', async () => {
    const json: CatalogJson = {
      version: '2.1',
      components: [{ name: 'Alpha', role: 'field', propsSchema: {} }],
    };
    const kits = createKitsService({
      sources: [{ kit: { id: 'kit-a' }, catalog: () => Promise.resolve(json) }],
    });

    await kits.whenReady();

    expect(names(kits.catalogJson())).toEqual(['Alpha']);
    expect(kits.descriptor().id).toBe('kit-a');
  });

  it('переключение заводит загрузку нового кита и не ждёт её', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const b = lazyKit('kit-b', 'Beta');
    const kits = createKitsService({ sources: [a.source, b.source] });

    await kits.activate('kit-b');

    expect(kits.activeId()).toBe('kit-b');
    expect(b.calls()).toBe(1);
    expect(kits.catalogJson().components).toEqual([]);

    const ready = kits.whenReady();
    b.deliver();
    await ready;

    expect(names(kits.catalogJson())).toEqual(['Beta']);
  });

  it('ленивый и поставленный значением уживаются в одной службе', async () => {
    const b = lazyKit('kit-b', 'Beta');
    const kits = createKitsService({ sources: [KIT_A, b.source] });

    // Кит значением готов сразу — ждать ему нечего.
    expect(names(kits.catalogJson())).toEqual(['Alpha']);
    await expect(kits.whenReady()).resolves.toBeUndefined();
    expect(b.calls()).toBe(0);

    await kits.activate('kit-b');
    const ready = kits.whenReady();
    b.deliver();
    await ready;

    expect(names(kits.catalogJson())).toEqual(['Beta']);
  });
});

/** Кит плагина: каталог значением, имя — блоком `kit`. */
function contributed(id: string, component: string, pluginId = 'acme'): ContributedKit {
  return { source: kit(id, `Кит ${id}`, component), pluginId };
}

/** Проверка контракта без ajv: годен всякий каталог, кроме помеченного `bogus`. */
const fakeValidator: KitsServiceOptions['validator'] = () =>
  Promise.resolve<CatalogValidator>((json) =>
    (json as { bogus?: unknown }).bogus === undefined
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['/ must NOT have additional properties'] }
  );

function withPlugins(options: Partial<KitsServiceOptions> = {}) {
  const problems: KitProblem[] = [];
  const kits = createKitsService({
    sources: [KIT_A],
    validator: fakeValidator,
    onProblem: (problem) => problems.push(problem),
    ...options,
  });
  return { kits, problems };
}

describe('киты плагинов', () => {
  it('внесённый кит появляется в списке с происхождением, и об этом узнают', () => {
    const { kits } = withPlugins();
    const changed = vi.fn();
    kits.onDidChangeAvailable(changed);

    kits.syncContributed([contributed('hexa', 'Hexa')]);

    expect(changed).toHaveBeenCalledTimes(1);
    expect(kits.available().map(({ id, origin }) => ({ id, origin }))).toEqual([
      { id: 'kit-a', origin: BUILTIN },
      { id: 'hexa', origin: { kind: 'plugin', pluginId: 'acme' } },
    ]);
  });

  it('тот же состав — ни одного уведомления: точку синхронизируют на каждое её изменение', () => {
    const { kits } = withPlugins();
    const hexa = contributed('hexa', 'Hexa');
    kits.syncContributed([hexa]);
    const changed = vi.fn();
    kits.onDidChangeAvailable(changed);

    kits.syncContributed([hexa]);

    expect(changed).not.toHaveBeenCalled();
  });

  it('каталог кита плагина сверяется с контрактом, прежде чем попасть к стекам', async () => {
    const { kits } = withPlugins();
    kits.syncContributed([contributed('hexa', 'Hexa')]);

    const activation = kits.activate('hexa');
    // Проверка асинхронна: до неё каталог — шапка без записей.
    expect(kits.catalogJson().components).toEqual([]);
    await activation;
    expect(kits.activeOrigin()).toEqual({ kind: 'plugin', pluginId: 'acme' });

    await kits.whenReady();

    expect(names(kits.catalogJson())).toEqual(['Hexa']);
  });

  it('каталог, не прошедший контракт, — отказ и пустой каталог', async () => {
    const { kits, problems } = withPlugins();
    const source: KitSource = {
      catalog: { ...catalogOf('hexa', 'Hexa', 'Hexa'), bogus: true } as CatalogJson,
    };
    kits.syncContributed([{ source, pluginId: 'acme' }]);

    await kits.activate('hexa');
    await kits.whenReady();

    expect(kits.catalogJson().components).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({ code: 'invalid-catalog', pluginId: 'acme', kitId: 'hexa' }),
    ]);
  });

  it('кит без имени в список не попадает — и об отказе сообщают один раз', () => {
    const { kits, problems } = withPlugins();
    const nameless: ContributedKit = {
      source: { catalog: () => Promise.resolve(catalogOf('x', 'X', 'X')) },
      pluginId: 'acme',
    };

    kits.syncContributed([nameless]);
    kits.syncContributed([nameless]);

    expect(kits.available().map((summary) => summary.id)).toEqual(['kit-a']);
    expect(problems).toEqual([{ code: 'no-id', pluginId: 'acme' }]);
  });

  it('занятое имя — отказ: встроенный побеждает, затем первый по порядку точки', () => {
    const { kits, problems } = withPlugins();

    kits.syncContributed([
      contributed('kit-a', 'Самозванец', 'impostor'),
      contributed('hexa', 'Hexa', 'first'),
      contributed('hexa', 'Hexa2', 'second'),
    ]);

    expect(kits.available().map(({ id, origin }) => ({ id, origin }))).toEqual([
      { id: 'kit-a', origin: BUILTIN },
      { id: 'hexa', origin: { kind: 'plugin', pluginId: 'first' } },
    ]);
    expect(problems).toEqual([
      { code: 'duplicate', pluginId: 'impostor', kitId: 'kit-a' },
      { code: 'duplicate', pluginId: 'second', kitId: 'hexa' },
    ]);
  });

  it('выбор, сделанный раньше, чем поднялся плагин, включается сам — настройка не пишется', () => {
    const settings = fakeSettings({ [KIT_SETTINGS_KEY]: 'hexa' });
    const { kits } = withPlugins({ settings });
    const changed = vi.fn();
    kits.onDidChange(changed);
    expect(kits.activeId()).toBe('kit-a');

    kits.syncContributed([contributed('hexa', 'Hexa')]);

    expect(kits.activeId()).toBe('hexa');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(settings.written).toEqual([]);
  });

  it('плагин выключили — на умолчание, а выбор цел; вернули — вернулся и выбор', () => {
    const settings = fakeSettings({ [KIT_SETTINGS_KEY]: 'hexa' });
    const { kits } = withPlugins({ settings });
    const hexa = contributed('hexa', 'Hexa');
    kits.syncContributed([hexa]);

    kits.syncContributed([]);

    expect(kits.activeId()).toBe('kit-a');
    expect(kits.available().map((summary) => summary.id)).toEqual(['kit-a']);
    expect(settings.get(KIT_SETTINGS_KEY)).toBe('hexa');

    kits.syncContributed([hexa]);

    expect(kits.activeId()).toBe('hexa');
    expect(settings.written).toEqual([]);
  });

  it('тот же кит другим источником — для читателя смена кита', () => {
    const { kits } = withPlugins();
    kits.syncContributed([contributed('hexa', 'Hexa')]);
    void kits.activate('hexa');
    const changed = vi.fn();
    kits.onDidChange(changed);

    kits.syncContributed([contributed('hexa', 'Hexa v2')]);

    expect(kits.activeId()).toBe('hexa');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('кит, снятый во время проверки каталога, не возвращается', async () => {
    const { kits } = withPlugins();
    kits.syncContributed([contributed('hexa', 'Hexa')]);
    await kits.activate('hexa');
    const pending = kits.whenReady();

    kits.syncContributed([]);
    await pending;

    expect(kits.activeId()).toBe('kit-a');
    expect(names(kits.catalogJson())).toEqual(['Alpha']);
  });

  it('о пространстве имён кита, внесённого позже подписки, подписчик тоже узнаёт', async () => {
    const { kits } = withPlugins();
    const loaded = vi.fn();
    kits.onDidLoadNamespace(loaded);
    const namespace: KitNamespace = { Hexa: () => null };
    kits.syncContributed([
      {
        source: { ...kit('hexa', 'Hexa', 'Hexa'), namespace: () => Promise.resolve(namespace) },
        pluginId: 'acme',
      },
    ]);
    await kits.activate('hexa');

    expect(kits.namespace()).toBeNull();
    await vi.waitFor(() => {
      expect(loaded).toHaveBeenCalledTimes(1);
    });
    expect(kits.namespace()).toBe(namespace);
  });
});
