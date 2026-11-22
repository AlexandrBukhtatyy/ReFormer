import { describe, expect, it } from 'vitest';
import {
  toDescriptor,
  type CatalogRecord,
  type KitAdapters,
  type KitNamespace,
  type KitOrigin,
} from '@reformer/builder-plugin-api';
import { kitImportOverrides, kitImportSpecifiers, mergeOverrides } from './kit-imports';

const PLUGIN: KitOrigin = { kind: 'plugin', pluginId: 'kit-hexa-ui' };
const BUILTIN: KitOrigin = { kind: 'builtin' };

interface DescriptorOptions {
  /** Свой спецификатор импорта; без него — имя пакета. */
  readonly importSpecifier?: string;
  /** Записи каталога: имя → подпуть (`null` — запись из главного входа). */
  readonly records?: Readonly<Record<string, string | null>>;
  readonly adapters?: KitAdapters;
}

/** Дескриптор кита с пакетом `@vendor/hexa`, его записями и адаптерами. */
function descriptor(options: DescriptorOptions = {}) {
  const components = Object.entries(options.records ?? {}).map(
    ([name, subpath]): CatalogRecord => ({
      name,
      role: 'field',
      propsSchema: {},
      ...(subpath === null ? {} : { subpath }),
    })
  );
  return toDescriptor({
    version: '2.1',
    kit: {
      id: 'hexa',
      label: 'Hexa',
      package: '@vendor/hexa',
      ...(options.importSpecifier === undefined
        ? {}
        : { codegen: { importSpecifier: options.importSpecifier } }),
      ...(options.adapters === undefined ? {} : { adapters: options.adapters }),
    },
    components,
  });
}

describe('подстановка пакета кита', () => {
  it('кит плагина: спецификатор пакета → его namespace', () => {
    const namespace: KitNamespace = { Button: () => null };

    const overrides = kitImportOverrides({ origin: PLUGIN, descriptor: descriptor(), namespace });

    expect([...overrides]).toEqual([['@vendor/hexa', namespace]]);
  });

  it('спецификатор — из кодогена кита, если кит его объявил', () => {
    const namespace: KitNamespace = {};

    const overrides = kitImportOverrides({
      origin: PLUGIN,
      descriptor: descriptor({ importSpecifier: '@vendor/hexa/react' }),
      namespace,
    });

    expect([...overrides.keys()]).toEqual(['@vendor/hexa/react']);
  });

  it('встроенный кит не подставляется: его пакет отдаёт реестр модулей оболочки', () => {
    const overrides = kitImportOverrides({
      origin: BUILTIN,
      descriptor: descriptor(),
      namespace: {},
    });

    expect(overrides.size).toBe(0);
  });

  it('namespace ещё не доехал или службы китов нет — подставлять нечего', () => {
    expect(
      kitImportOverrides({ origin: PLUGIN, descriptor: descriptor(), namespace: null }).size
    ).toBe(0);
    expect(kitImportOverrides({ origin: null, descriptor: null, namespace: null }).size).toBe(0);
  });

  it('тот же кит — та же карта: эффект компиляции не перезапускается без повода', () => {
    const namespace: KitNamespace = {};
    const kit = { origin: PLUGIN, descriptor: descriptor(), namespace };

    expect(kitImportOverrides(kit)).toBe(kitImportOverrides({ ...kit, descriptor: descriptor() }));
    expect(kitImportOverrides(kit)).not.toBe(kitImportOverrides({ ...kit, namespace: {} }));
  });
});

describe('подпути кита плагина', () => {
  /** Кит, часть записей которого лежит за подпутями, а визард — за своим. */
  const withSubpaths = () =>
    descriptor({
      records: { Input: null, Chart: 'chart', Combobox: 'combobox', ComboboxMulti: 'combobox' },
      adapters: { wizard: { symbol: 'Wizard', subpath: 'wizard' }, step: null },
    });

  it('подпуть записи и подпуть адаптера резолвятся в то же пространство имён, что и корень', () => {
    const namespace: KitNamespace = { Input: () => null, Chart: () => null };

    const overrides = kitImportOverrides({
      origin: PLUGIN,
      descriptor: withSubpaths(),
      namespace,
    });

    // Главный вход первым, подпути — по алфавиту и без повторов (у двух записей он один).
    expect([...overrides.keys()]).toEqual([
      '@vendor/hexa',
      '@vendor/hexa/chart',
      '@vendor/hexa/combobox',
      '@vendor/hexa/wizard',
    ]);
    for (const value of overrides.values()) expect(value).toBe(namespace);
  });

  it('подпуть считается от спецификатора кодогена, а не от имени пакета', () => {
    const specifiers = kitImportSpecifiers(
      descriptor({ importSpecifier: '@vendor/hexa/react', records: { Chart: 'chart' } })
    );

    expect(specifiers).toEqual(['@vendor/hexa/react', '@vendor/hexa/react/chart']);
  });

  it('адаптер без подпутя и отсутствующий адаптер подпутей не добавляют', () => {
    const specifiers = kitImportSpecifiers(
      descriptor({ adapters: { wizard: { symbol: 'Wizard' }, step: null } })
    );

    expect(specifiers).toEqual(['@vendor/hexa']);
  });

  it('подпуть, которого кит не объявил, не подставляется', () => {
    const overrides = kitImportOverrides({
      origin: PLUGIN,
      descriptor: withSubpaths(),
      namespace: {},
    });

    expect(overrides.has('@vendor/hexa/table')).toBe(false);
  });

  it('у встроенного кита подпути не подставляются тоже: их отдаёт реестр оболочки', () => {
    const overrides = kitImportOverrides({
      origin: BUILTIN,
      descriptor: withSubpaths(),
      namespace: {},
    });

    expect(overrides.size).toBe(0);
  });

  it('тот же набор подпутей — та же карта; другой набор — другая', () => {
    const namespace: KitNamespace = {};
    const kit = { origin: PLUGIN, descriptor: withSubpaths(), namespace };

    expect(kitImportOverrides(kit)).toBe(
      kitImportOverrides({ ...kit, descriptor: withSubpaths() })
    );
    expect(kitImportOverrides(kit)).not.toBe(
      kitImportOverrides({ ...kit, descriptor: descriptor({ records: { Chart: 'chart' } }) })
    );
  });
});

describe('подстановки кита и фикстуры вместе', () => {
  it('фикстура побеждает кит на том же спецификаторе, остальное складывается', () => {
    const kit = new Map<string, unknown>([['@vendor/hexa', 'namespace']]);

    const merged = mergeOverrides(kit, { '@vendor/hexa': 'из фикстуры', './api': 'api' });

    expect(merged).toEqual(
      new Map<string, unknown>([
        ['@vendor/hexa', 'из фикстуры'],
        ['./api', 'api'],
      ])
    );
  });

  it('подставлять нечего — нет и карты', () => {
    expect(mergeOverrides(new Map(), undefined)).toBeUndefined();
    expect(mergeOverrides(new Map(), {})).toBeUndefined();
  });

  it('карта кита не меняется слиянием', () => {
    const kit = new Map<string, unknown>([['@vendor/hexa', 'namespace']]);

    mergeOverrides(kit, { '@vendor/hexa': 'из фикстуры' });

    expect(kit.get('@vendor/hexa')).toBe('namespace');
  });
});
