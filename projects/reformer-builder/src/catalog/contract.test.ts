import { describe, expect, it } from 'vitest';
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
import { loadCatalogJson, buildCatalogFromJson, validateCatalog } from './contract';
import { kindOf } from '../model';

describe('loadCatalogJson (клиентский каталог ui-kit + синтетические)', () => {
  const json = loadCatalogJson();

  it('версия + ВСЕ rich-компоненты ui-kit + синтетические', () => {
    expect(typeof json.version).toBe('string');
    expect(json.version.length).toBeGreaterThan(0);
    const names = new Set(json.components.map((c) => c.name));
    // Все rich-компоненты (defaultPropSchemas) присутствуют.
    for (const name of Object.keys(defaultPropSchemas)) expect(names.has(name)).toBe(true);
    // Синтетические билдера.
    expect(names.has('$html(div)')).toBe(true);
    expect(names.has('FormArray')).toBe(true);
  });

  it('все компоненты доступны: minimal-записи тоже в каталоге', () => {
    const names = new Set(json.components.map((c) => c.name));
    // Компоненты без props.ts (minimal) — тоже в палитре.
    for (const name of ['Alert', 'Card', 'Accordion', 'Tabs', 'Dialog', 'Tooltip', 'Table']) {
      expect(names.has(name)).toBe(true);
    }
    // Каталог существенно шире 20 rich-компонентов.
    expect(json.components.length).toBeGreaterThan(40);
  });

  it('явный role у каждой записи', () => {
    expect(json.components.every((c) => ['field', 'container', 'array'].includes(c.role))).toBe(true);
    expect(json.components.find((c) => c.name === 'Input')?.role).toBe('field');
    expect(json.components.find((c) => c.name === 'Box')?.role).toBe('container');
    expect(json.components.find((c) => c.name === 'FormArray')?.role).toBe('array');
  });
});

describe('validateCatalog (контракт)', () => {
  it('поставляемый каталог проходит контракт (self-check)', () => {
    const res = validateCatalog(loadCatalogJson());
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

describe('buildCatalogFromJson (реконструкция makeNode + категория)', () => {
  it('makeNode восстанавливается, kindOf совпадает с role', () => {
    const entries = buildCatalogFromJson(loadCatalogJson());
    for (const e of entries) expect(kindOf(e.makeNode())).toBe(e.role);
  });

  it('категория палитры назначается каждой записи', () => {
    const entries = buildCatalogFromJson(loadCatalogJson());
    for (const e of entries) {
      expect(typeof e.category).toBe('string');
      expect((e.category ?? '').length).toBeGreaterThan(0);
    }
    expect(entries.find((e) => e.name === 'Input')?.category).toBe('Поля ввода');
    expect(entries.find((e) => e.name === 'Dialog')?.category).toBe('Оверлеи');
  });
});
