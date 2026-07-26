import { describe, expect, it } from 'vitest';
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
import { buildCatalog } from './catalog';
import { getCatalog, getCatalogEntry } from './index';
import { kindOf } from '../model';

describe('buildCatalog', () => {
  const catalog = buildCatalog();

  it('запись есть на каждое имя defaultPropSchemas + синтетические', () => {
    const names = new Set(catalog.map((e) => e.name));
    for (const name of Object.keys(defaultPropSchemas)) expect(names.has(name)).toBe(true);
    // синтетические
    expect(names.has('$html(div)')).toBe(true);
    expect(names.has('FormArray')).toBe(true);
  });

  it('field-запись несёт wrapper-пропы (label/required) в propsSchema', () => {
    const input = catalog.find((e) => e.name === 'Input')!;
    expect(input.role).toBe('field');
    const props = input.propsSchema.properties ?? {};
    expect(props).toHaveProperty('label');
    expect(props).toHaveProperty('required');
    expect(props).toHaveProperty('type');
  });

  it('propsSchema field-записи не показывает seam как обычный проп', () => {
    const input = catalog.find((e) => e.name === 'Input')!;
    expect(input.propsSchema.properties).not.toHaveProperty('value');
    // но x-runtimeProps сохранён (для валидации/справки), просто скрывается инспектором
    expect(input.propsSchema['x-runtimeProps']).toBeDefined();
  });

  it('makeNode() даёт узел, чей kindOf совпадает с role', () => {
    for (const entry of catalog) {
      expect(kindOf(entry.makeNode())).toBe(entry.role);
    }
  });

  it('категории проставлены', () => {
    expect(catalog.find((e) => e.name === 'Input')!.category).toBe('Поля ввода');
    expect(catalog.find((e) => e.name === 'Box')!.category).toBe('Контейнеры');
    expect(catalog.find((e) => e.name === '$html(div)')!.category).toBe('HTML');
    expect(catalog.find((e) => e.name === 'FormArray')!.category).toBe('Массив');
  });
});

describe('getCatalog / getCatalogEntry', () => {
  it('мемоизирован (одна ссылка)', () => {
    expect(getCatalog()).toBe(getCatalog());
  });
  it('поиск по имени', () => {
    expect(getCatalogEntry('Select')?.role).toBe('field');
    expect(getCatalogEntry('нет-такого')).toBeUndefined();
  });
});
