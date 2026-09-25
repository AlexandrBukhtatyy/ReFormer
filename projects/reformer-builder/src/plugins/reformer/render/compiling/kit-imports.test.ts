import { describe, expect, it } from 'vitest';
import { toDescriptor, type KitNamespace, type KitOrigin } from '@reformer/builder-plugin-api';
import { kitImportOverrides, mergeOverrides } from './kit-imports';

const PLUGIN: KitOrigin = { kind: 'plugin', pluginId: 'kit-hexa-ui' };
const BUILTIN: KitOrigin = { kind: 'builtin' };

/** Дескриптор кита с пакетом `@vendor/hexa` и, по желанию, своим спецификатором импорта. */
function descriptor(importSpecifier?: string) {
  return toDescriptor({
    version: '2.1',
    kit: {
      id: 'hexa',
      label: 'Hexa',
      package: '@vendor/hexa',
      ...(importSpecifier === undefined ? {} : { codegen: { importSpecifier } }),
    },
    components: [],
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
      descriptor: descriptor('@vendor/hexa/react'),
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
