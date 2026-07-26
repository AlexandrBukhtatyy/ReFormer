import { describe, expect, it } from 'vitest';
import { defineRegistry, getDataSourceNames, type JsonFormSchema } from '@reformer/renderer-json';
import { registerMockSources, collectFunctionLikeDataSources } from './mock-sources';
import { sampleSchema } from '../model/__fixtures__/sample-schema';

describe('collectFunctionLikeDataSources', () => {
  it('itemLabel-dataSource помечается как функция', () => {
    expect([...collectFunctionLikeDataSources(sampleSchema())]).toEqual(['PROP_LABEL']);
  });
});

describe('registerMockSources', () => {
  it('регистрирует все dataSources схемы', () => {
    const reg = defineRegistry((r) => registerMockSources(r, sampleSchema()));
    expect(getDataSourceNames(reg)).toEqual(expect.arrayContaining(['LOAN_TYPES', 'PROP_LABEL']));
  });

  it('не падает на схеме без источников', () => {
    const schema = {
      version: '1.0',
      root: { component: '$component(Box)', children: [] },
    } as unknown as JsonFormSchema;
    expect(() => defineRegistry((r) => registerMockSources(r, schema))).not.toThrow();
  });
});
