import { describe, expect, it } from 'vitest';
import { defineRegistry, getDataSourceNames, type JsonFormSchema } from '@reformer/renderer-json';
import { registerMockSources } from './mock-sources';
import { sampleSchema } from '../model/__fixtures__/sample-schema';

describe('registerMockSources', () => {
  it('регистрирует все dataSources схемы', () => {
    const reg = defineRegistry((r) => registerMockSources(r, sampleSchema()));
    expect(getDataSourceNames(reg)).toEqual(expect.arrayContaining(['LOAN_TYPES', 'PROP_LABEL']));
  });

  it('optionLike получает массив опций, functionLike (itemLabel) — функцию', () => {
    const reg = defineRegistry((r) => registerMockSources(r, sampleSchema()));
    expect(Array.isArray(reg.get('LOAN_TYPES')?.component)).toBe(true);
    expect(typeof reg.get('PROP_LABEL')?.component).toBe('function');
  });

  it('переданные значения источников переопределяют синтез', () => {
    const custom = [{ value: 'x', label: 'X' }];
    const reg = defineRegistry((r) =>
      registerMockSources(r, sampleSchema(), { LOAN_TYPES: custom })
    );
    expect(reg.get('LOAN_TYPES')?.component).toBe(custom);
  });

  it('не падает на схеме без источников', () => {
    const schema = {
      version: '1.0',
      root: { component: '$component(Box)', children: [] },
    } as unknown as JsonFormSchema;
    expect(() => defineRegistry((r) => registerMockSources(r, schema))).not.toThrow();
  });
});
