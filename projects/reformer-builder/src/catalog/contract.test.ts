import { describe, expect, it } from 'vitest';
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
import { buildCatalogJson, buildCatalogFromJson, validateCatalog } from './contract';
import { CATALOG_CONTRACT_VERSION } from './types';
import { kindOf } from '../model';

describe('buildCatalogJson (адаптер §5)', () => {
  const json = buildCatalogJson();

  it('версия + все имена defaultPropSchemas + синтетические', () => {
    expect(json.version).toBe(CATALOG_CONTRACT_VERSION);
    const names = new Set(json.components.map((c) => c.name));
    for (const name of Object.keys(defaultPropSchemas)) expect(names.has(name)).toBe(true);
    expect(names.has('$html(div)')).toBe(true);
    expect(names.has('FormArray')).toBe(true);
  });

  it('явный role у каждой записи', () => {
    expect(json.components.every((c) => ['field', 'container', 'array'].includes(c.role))).toBe(true);
    expect(json.components.find((c) => c.name === 'Input')?.role).toBe('field');
    expect(json.components.find((c) => c.name === 'Box')?.role).toBe('container');
    expect(json.components.find((c) => c.name === 'FormArray')?.role).toBe('array');
  });
});

describe('validateCatalog (контракт)', () => {
  it('вывод адаптера проходит контракт (self-check)', () => {
    const res = validateCatalog(buildCatalogJson());
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('битый каталог отклоняется', () => {
    expect(validateCatalog({ components: [] }).valid).toBe(false); // нет version
    expect(
      validateCatalog({ version: '1.0', components: [{ name: 'X', role: 'widget', propsSchema: {} }] })
        .valid
    ).toBe(false); // role вне enum
    expect(
      validateCatalog({ version: '1.0', components: [{ name: 'X', role: 'field' }] }).valid
    ).toBe(false); // нет propsSchema
  });
});

describe('buildCatalogFromJson (реконструкция makeNode)', () => {
  it('makeNode восстанавливается, kindOf совпадает с role', () => {
    const entries = buildCatalogFromJson(buildCatalogJson());
    for (const e of entries) expect(kindOf(e.makeNode())).toBe(e.role);
  });
});
