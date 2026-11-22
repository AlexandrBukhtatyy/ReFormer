import { describe, it, expect } from 'vitest';
import { defineRegistry, composeRegistries, ComponentRegistryImpl } from './component-registry';
import { LOCALE_SERVICE } from './constants';
import { createLocaleResolver } from '../locale/locale-service';
import { getFnNames, getDataSourceNames } from '../schema';

const noop = (): null => null;

describe('defineRegistry — reg.fn', () => {
  it('registers a function under type "fn"', () => {
    const fn = (): string => 'x';
    const reg = defineRegistry((r) => r.fn('formatCurrency', fn));
    expect(reg.get('formatCurrency')).toEqual({
      component: fn,
      type: 'fn',
      description: undefined,
    });
  });

  it('throws when a non-function is passed', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defineRegistry((r) => r.fn('nope', 123 as any))
    ).toThrow(/expects a function/i);
  });

  it('keeps fn out of dataSource enumeration and vice versa', () => {
    const reg = defineRegistry((r) => {
      r.fn('itemLabel', () => '#1');
      r.dataSource('LOAN_TYPES', [{ value: 'a', label: 'A' }]);
    });
    expect(getFnNames(reg)).toEqual(['itemLabel']);
    expect(getDataSourceNames(reg)).toEqual(['LOAN_TYPES']);
  });
});

describe('defineRegistry — reg.locale', () => {
  it('stores the service under the reserved LOCALE_SERVICE key and exposes it via getLocale()', () => {
    const svc = createLocaleResolver({ 'a.b': 'AB' });
    const reg = defineRegistry((r) => r.locale(svc));
    expect(reg.get(LOCALE_SERVICE)?.type).toBe('locale');
    expect(reg.getLocale?.()).toBe(svc);
    expect(reg.getLocale?.()?.resolve('a.b')).toBe('AB');
    expect(reg.getLocale?.()?.resolve('missing')).toBe('missing'); // fallback-to-key
  });

  it('wraps a bare resolver function into a LocaleService', () => {
    const reg = defineRegistry((r) => r.locale((k) => k.toUpperCase()));
    expect(reg.getLocale?.()?.resolve('x')).toBe('X');
    expect(reg.getLocale?.()?.keys).toBeUndefined(); // без каталога — нет validate-проверки ключей
  });

  it('locale service is not listed as a dataSource', () => {
    const reg = defineRegistry((r) => r.locale(createLocaleResolver({ k: 'v' })));
    expect(getDataSourceNames(reg)).not.toContain(LOCALE_SERVICE);
    expect(reg.getDataSource(LOCALE_SERVICE)).toBeUndefined();
  });
});

describe('ComponentRegistryImpl.withParent — new kinds', () => {
  it('merges fn and locale entries across the parent chain', () => {
    const parent = defineRegistry((r) => r.fn('parentFn', noop));
    const child = defineRegistry((r) => r.locale(createLocaleResolver({ k: 'v' })));
    const merged = ComponentRegistryImpl.withParent(parent, child);
    expect(merged.get('parentFn')?.type).toBe('fn');
    expect(merged.getLocale?.()?.resolve('k')).toBe('v');
  });
});

describe('ComponentRegistryImpl.withParent — многоуровневая композиция', () => {
  const CompA = (): null => null;
  const CompB = (): null => null;

  it('сохраняет цепочку СОСТАВНОГО child (регрессия: терялся средний уровень)', () => {
    // Расклад микрофронта: ядро + расширения МФ, и всё это под реестром хоста.
    const core = defineRegistry((r) => r.component('Input', CompA));
    const mfe = defineRegistry((r) => r.component('DomainField', CompA));
    const inner = ComponentRegistryImpl.withParent(core, mfe);

    const host = defineRegistry((r) => r.component('HostShell', CompA));
    const outer = ComponentRegistryImpl.withParent(host, inner);

    expect(outer.has('Input')).toBe(true); // ← падало: ядро терялось при копировании child
    expect(outer.has('DomainField')).toBe(true);
    expect(outer.has('HostShell')).toBe(true);
    expect(outer.names()).toEqual(expect.arrayContaining(['Input', 'DomainField', 'HostShell']));
  });

  it('приоритет last-wins: child перекрывает parent', () => {
    const first = defineRegistry((r) => r.component('X', CompA));
    const second = defineRegistry((r) => r.component('X', CompB));
    expect(ComponentRegistryImpl.withParent(first, second).get('X')?.component).toBe(CompB);
  });

  it('в глубокой цепочке выигрывает самый внутренний', () => {
    const l1 = defineRegistry((r) => r.component('X', CompA));
    const l2 = defineRegistry((r) => r.component('X', CompB));
    const l3 = defineRegistry((r) => r.component('X', noop));
    const merged = ComponentRegistryImpl.withParent(ComponentRegistryImpl.withParent(l1, l2), l3);
    expect(merged.get('X')?.component).toBe(noop);
  });

  it('composeRegistries: три уровня, последний перекрывает', () => {
    const core = defineRegistry((r) => {
      r.component('Input', CompA);
      r.component('Shared', CompA);
    });
    const mfe = defineRegistry((r) => {
      r.component('DomainField', CompB);
      r.component('Shared', CompB);
    });
    const form = defineRegistry((r) => r.component('Shared', noop));

    const merged = composeRegistries(core, mfe, form);
    expect(merged.has('Input')).toBe(true);
    expect(merged.has('DomainField')).toBe(true);
    expect(merged.get('Shared')?.component).toBe(noop); // самый правый выигрывает
  });

  it('composeRegistries: пустой список даёт пустой реестр', () => {
    expect(composeRegistries().names()).toEqual([]);
  });

  it('composeRegistries: один аргумент возвращается как есть по содержимому', () => {
    const only = defineRegistry((r) => r.component('X', CompA));
    expect(composeRegistries(only).get('X')?.component).toBe(CompA);
  });

  it('поддерживает чужую реализацию ComponentRegistry как child', () => {
    const core = defineRegistry((r) => r.component('Input', CompA));
    const custom = {
      get: (n: string) =>
        n === 'Custom' ? { component: CompB, type: 'component' as const } : undefined,
      getDataSource: () => undefined,
      has: (n: string) => n === 'Custom',
      names: () => ['Custom'],
    };
    const merged = ComponentRegistryImpl.withParent(core, custom);
    expect(merged.has('Input')).toBe(true);
    expect(merged.get('Custom')?.component).toBe(CompB);
  });
});
