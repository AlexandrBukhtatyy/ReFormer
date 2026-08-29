import { describe, expect, it, vi } from 'vitest';

import type { CatalogJson } from '@/lib/catalog/types';
import type { Disposable } from '@/sdk';
import { BUILTIN_KIT } from './builtin';
import type { KitsSettings } from './host';
import { createKitsService, KIT_SETTINGS_KEY, KitsServiceToken, type KitSource } from './service';

/** Кит из одного поля — достаточно, чтобы отличить один каталог от другого. */
function kit(id: string, label: string, component: string): KitSource {
  const catalog: CatalogJson = {
    version: '2.0',
    kit: { id, label, package: `@vendor/${id}`, version: '1.2.3' },
    components: [{ name: component, role: 'field', propsSchema: { type: 'object' } }],
  };
  return { catalog };
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

describe('состав сервиса', () => {
  it('токен один на всех: ключом служит строка, а не объект объявления', () => {
    expect(KitsServiceToken.id).toBe('kits.active');
  });

  it('без китов сервиса не бывает: делать активным нечего', () => {
    expect(() => createKitsService({ sources: [] })).toThrow(/пуст/u);
  });

  it('два кита под одним идентификатором — отказ, а не молчаливая замена', () => {
    expect(() => createKitsService({ sources: [KIT_A, kit('kit-a', 'Двойник', 'Gamma')] })).toThrow(
      /дважды/u
    );
  });

  it('первый зарегистрированный кит — умолчание и активный, пока не выбрано иное', () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    expect(kits.defaultId).toBe('kit-a');
    expect(kits.activeId()).toBe('kit-a');
  });

  it('список доступных отвечает и на «между чем выбирать», и на «что включено»', () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    expect(kits.available()).toEqual([
      { id: 'kit-a', label: 'Кит А', package: '@vendor/kit-a', version: '1.2.3', active: true },
      { id: 'kit-b', label: 'Кит Б', package: '@vendor/kit-b', version: '1.2.3', active: false },
    ]);
  });
});

describe('активный кит', () => {
  it('каталог и дескриптор — активного кита, а не первого попавшегося', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    expect(kits.catalog().map((entry) => entry.name)).toContain('Alpha');
    expect(kits.descriptor().id).toBe('kit-a');

    await kits.activate('kit-b');

    expect(kits.catalog().map((entry) => entry.name)).toContain('Beta');
    expect(kits.catalog().map((entry) => entry.name)).not.toContain('Alpha');
    expect(kits.descriptor().id).toBe('kit-b');
  });

  it('каталог-JSON отдаётся после склейки с синтетикой: это источник правды диагностики', () => {
    const kits = createKitsService({ sources: [KIT_A] });

    const names = kits.catalogJson().components.map((record) => record.name);
    expect(names).toContain('Alpha');
    // Синтетические записи билдера — часть каталога, иначе валидатор ругался бы на FormArray.
    expect(names).toContain('FormArray');
  });

  it('снимок стабилен между сменами и обновляется вместе с китом', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });

    const before = kits.catalog();
    expect(kits.catalog()).toBe(before);
    expect(kits.available()).toBe(kits.available());

    await kits.activate('kit-b');

    expect(kits.catalog()).not.toBe(before);
  });

  it('возврат к прежнему киту отдаёт ТУ ЖЕ сборку: пересобирать нечего', async () => {
    const kits = createKitsService({ sources: [KIT_A, KIT_B] });
    const first = kits.catalog();

    await kits.activate('kit-b');
    await kits.activate('kit-a');

    expect(kits.catalog()).toBe(first);
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

  it('правка настройки МИМО сервиса меняет активный кит', async () => {
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

  it('без настроек сервис работает: выбор просто не переживёт перезагрузку', async () => {
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
  it('берётся из самого пакета, а не из копии в билдере', () => {
    const kits = createKitsService({ sources: [BUILTIN_KIT] });

    expect(kits.activeId()).toBe('reformer-ui-kit');
    expect(kits.descriptor().package).toBe('@reformer/ui-kit');
  });

  it('поставляется загрузчиком: 864 кБ каталога не место в главном чанке', () => {
    expect(typeof BUILTIN_KIT.catalog).toBe('function');
  });

  it('до загрузки представляется тем же, чем и после: шапки у него нет по обе стороны', async () => {
    const kits = createKitsService({ sources: [BUILTIN_KIT] });
    const before = kits.available();

    await kits.whenReady();

    expect(kits.available()).toEqual(before);
    expect(kits.descriptor().id).toBe('reformer-ui-kit');
    expect(kits.descriptor().package).toBe('@reformer/ui-kit');
  });

  it('его каталог не пуст — иначе валидатор молчит не потому, что схема верна', async () => {
    const kits = createKitsService({ sources: [BUILTIN_KIT] });

    await kits.whenReady();

    const names = kits.catalog().map((entry) => entry.name);
    expect(names.length).toBeGreaterThan(50);
    expect(names).toContain('Input');
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
  const kit = { id, label: `Кит ${id}`, package: `@vendor/${id}`, version: '1.2.3' };
  const json: CatalogJson = {
    version: '2.0',
    kit: { ...kit, id: loaded },
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
    kit,
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

    expect(kits.available()).toEqual([
      { id: 'kit-a', label: 'Кит kit-a', package: '@vendor/kit-a', version: '1.2.3', active: true },
      {
        id: 'kit-b',
        label: 'Кит kit-b',
        package: '@vendor/kit-b',
        version: '1.2.3',
        active: false,
      },
    ]);
    expect(a.calls()).toBe(0);
    expect(b.calls()).toBe(0);
  });

  it('до загрузки каталог ПУСТ, а не выдуман синтетикой билдера', () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    expect(kits.catalog()).toEqual([]);
    // Ни одной записи: каталог из одной синтетики непуст для валидатора, и тот пометил бы
    // неизвестным каждый компонент открытой формы.
    expect(kits.catalogJson().components).toEqual([]);
    expect(kits.descriptor().id).toBe('kit-a');
  });

  it('каталог доехал — палитре есть что показывать', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    const ready = kits.whenReady();
    a.deliver();
    await ready;

    expect(kits.catalog().map((entry) => entry.name)).toContain('Alpha');
    // Синтетика билдера приезжает вместе с каталогом кита, а не вместо него.
    expect(kits.catalog().map((entry) => entry.name)).toContain('FormArray');
  });

  it('переход «пусто → загружено» доходит до подписчиков', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });
    const seen: number[] = [];
    kits.onDidChange(() => seen.push(kits.catalog().length));

    const ready = kits.whenReady();
    a.deliver();
    await ready;

    expect(seen).toHaveLength(1);
    // Подписчика зовут ПОСЛЕ подстановки: перечитав, он видит новый каталог, а не старый.
    expect(seen[0]).toBeGreaterThan(0);
  });

  it('снимок стабилен по обе стороны загрузки и меняется ровно один раз', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    const before = kits.catalog();
    expect(kits.catalog()).toBe(before);

    const ready = kits.whenReady();
    a.deliver();
    await ready;

    const after = kits.catalog();
    expect(after).not.toBe(before);
    expect(kits.catalog()).toBe(after);
  });

  it('загрузчик зовут один раз, сколько бы ни спрашивали', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    kits.catalog();
    kits.descriptor();
    const ready = kits.whenReady();
    void kits.whenReady();
    a.deliver();
    await ready;
    kits.catalog();

    expect(a.calls()).toBe(1);
  });

  it('синхронное чтение само заводит загрузку: иначе каталог не приехал бы никогда', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    expect(kits.catalog()).toEqual([]);
    expect(a.calls()).toBe(1);

    a.deliver();
    await kits.whenReady();

    expect(kits.catalog().map((entry) => entry.name)).toContain('Alpha');
  });

  it('отказ загрузки оставляет пустой каталог и не отвергает ожидание', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    const ready = kits.whenReady();
    a.refuse();
    await expect(ready).resolves.toBeUndefined();

    expect(kits.catalog()).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('не загрузился'), expect.any(Error));
    error.mockRestore();
  });

  it('сорвавшаяся загрузка не повторяется сама: читателя зовут на каждый кадр', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = lazyKit('kit-a', 'Alpha');
    const kits = createKitsService({ sources: [a.source] });

    const ready = kits.whenReady();
    a.refuse();
    await ready;

    kits.catalog();
    kits.catalog();
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
    expect(kits.catalog()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('не загрузился'),
      expect.objectContaining({ message: expect.stringContaining('зарегистрирован') })
    );
    error.mockRestore();
  });

  it('переключение заводит загрузку нового кита и не ждёт её', async () => {
    const a = lazyKit('kit-a', 'Alpha');
    const b = lazyKit('kit-b', 'Beta');
    const kits = createKitsService({ sources: [a.source, b.source] });

    await kits.activate('kit-b');

    expect(kits.activeId()).toBe('kit-b');
    expect(b.calls()).toBe(1);
    expect(kits.catalog()).toEqual([]);

    const ready = kits.whenReady();
    b.deliver();
    await ready;

    expect(kits.catalog().map((entry) => entry.name)).toContain('Beta');
  });

  it('ленивый и поставленный значением уживаются в одном сервисе', async () => {
    const b = lazyKit('kit-b', 'Beta');
    const kits = createKitsService({ sources: [KIT_A, b.source] });

    // Кит значением собирается синхронно — ждать ему нечего.
    expect(kits.catalog().map((entry) => entry.name)).toContain('Alpha');
    await expect(kits.whenReady()).resolves.toBeUndefined();
    expect(b.calls()).toBe(0);

    await kits.activate('kit-b');
    const ready = kits.whenReady();
    b.deliver();
    await ready;

    expect(kits.catalog().map((entry) => entry.name)).toContain('Beta');
  });
});
