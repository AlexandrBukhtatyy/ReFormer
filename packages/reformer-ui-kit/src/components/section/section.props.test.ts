import { describe, it, expect } from 'vitest';
import { sectionBasePropsSchema } from './variants/base/section-base.props';
import type { SectionProps } from './variants/base/section-base';

/**
 * Страж от дрейфа схемы. Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 *
 * Section — DSL-контейнер без seam, поэтому `x-runtimeProps` отсутствует (рантайм-поверхность ∅).
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof sectionBasePropsSchema.properties;

/** A: каждый ключ схемы существует в props Section (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaPropKeys extends keyof SectionProps ? true : false>;

describe('section props-схема — страж от дрейфа', () => {
  it('рантайм: x-runtimeProps отсутствует (DSL-контейнер без seam → поверхность ∅)', () => {
    expect('x-runtimeProps' in sectionBasePropsSchema).toBe(false);
  });

  it('x-registryName = Section (каноническое имя в реестре renderer-json)', () => {
    expect(sectionBasePropsSchema['x-registryName']).toBe('Section');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(sectionBasePropsSchema.additionalProperties).toBe(false);
  });

  it('titleAs enum покрывает уровни h1-h6', () => {
    expect(sectionBasePropsSchema.properties.titleAs.enum).toEqual([
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ]);
  });
});
