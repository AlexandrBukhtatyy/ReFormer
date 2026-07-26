import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { collectFieldDefaults, buildInitialValues, synthModel } from './synth-model';
import { sampleSchema } from '../model/__fixtures__/sample-schema';

describe('collectFieldDefaults', () => {
  it('верхнеуровневые дефолты; array→[]; без путей из item.$template', () => {
    const map = Object.fromEntries(collectFieldDefaults(sampleSchema()).map((d) => [d.path, d.value]));
    expect(map).toEqual({ loanType: '', loanAmount: null, properties: [] });
    expect(map).not.toHaveProperty('type'); // relative-путь шаблона не собирается
  });

  it('Checkbox/Switch → false, Slider → min', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          { value: '$model(agree)', component: '$component(Checkbox)' },
          { value: '$model(vol)', component: '$component(Slider)', componentProps: { min: 6 } },
        ],
      },
    } as unknown as JsonFormSchema;
    const map = Object.fromEntries(collectFieldDefaults(schema).map((d) => [d.path, d.value]));
    expect(map.agree).toBe(false);
    expect(map.vol).toBe(6);
  });
});

describe('buildInitialValues', () => {
  it('вложенный объект из дот-путей', () => {
    const iv = buildInitialValues([
      { path: 'a.b', value: '' },
      { path: 'a.c', value: null },
      { path: 'x', value: [] },
    ]);
    expect(iv).toEqual({ a: { b: '', c: null }, x: [] });
  });
});

describe('synthModel', () => {
  it('createModel из дефолтов; get() отдаёт форму', () => {
    const model = synthModel(sampleSchema());
    expect(model.get()).toEqual({ loanType: '', loanAmount: null, properties: [] });
  });
});
