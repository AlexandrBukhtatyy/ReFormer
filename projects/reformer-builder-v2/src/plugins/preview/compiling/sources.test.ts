/**
 * Отбор сайдкаров: что исполняется, а что нет.
 *
 * @module plugins/preview/compiling/sources.test
 */

import { describe, expect, it } from 'vitest';
import { fakeRef } from '../testing';
import { isExecutableSidecar, selectSidecars } from './sources';

describe('isExecutableSidecar', () => {
  it('сайдкары формы исполняются', () => {
    expect(isExecutableSidecar('model.ts')).toBe(true);
    expect(isExecutableSidecar('validation.ts')).toBe(true);
    expect(isExecutableSidecar('form.behavior.ts')).toBe(true);
    expect(isExecutableSidecar('registry.tsx')).toBe(true);
  });

  it('страница-обёртка не исполняется: это монтирование приложения внутрь приложения', () => {
    expect(isExecutableSidecar('index.tsx')).toBe(false);
    expect(isExecutableSidecar('index.ts')).toBe(false);
  });

  it('тесты и объявления типов не исполняются', () => {
    expect(isExecutableSidecar('validation.test.ts')).toBe(false);
    expect(isExecutableSidecar('model.spec.tsx')).toBe(false);
    expect(isExecutableSidecar('types.d.ts')).toBe(false);
  });

  it('не-TypeScript в набор не попадает', () => {
    expect(isExecutableSidecar('form.json')).toBe(false);
    expect(isExecutableSidecar('README.md')).toBe(false);
  });
});

describe('selectSidecars', () => {
  it('каталоги отбрасываются: каталог формы плоский', () => {
    const refs = [
      fakeRef('fake:form/model.ts'),
      fakeRef('fake:form/nested', { kind: 'directory' }),
      fakeRef('fake:form/form.json'),
    ];
    expect(selectSidecars(refs).map((ref) => ref.name)).toEqual(['model.ts']);
  });
});
