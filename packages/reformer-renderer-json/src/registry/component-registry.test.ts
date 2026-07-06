import { describe, it, expect } from 'vitest';
import { defineRegistry, ComponentRegistryImpl } from './component-registry';
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
