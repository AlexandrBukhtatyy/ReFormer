import { describe, it, expect } from 'vitest';
import { boxBasePropsSchema } from './variants/base/box-base.props';
import type { BoxProps } from './variants/base/box-base';

/**
 * Страж от дрейфа схемы. Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof boxBasePropsSchema.properties;

/** A: каждый ключ схемы существует в props компонента (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaPropKeys extends keyof BoxProps ? true : false>;

describe('box props-схема — страж от дрейфа', () => {
  it('рантайм: seam отсутствует (контейнер, не form-control → нет x-runtimeProps)', () => {
    // Box — DSL-контейнер: у него нет value/onChange/onBlur/disabled.
    expect('x-runtimeProps' in boxBasePropsSchema).toBe(false);
  });

  it('x-registryName = Box (каноническое имя в реестре renderer-json)', () => {
    expect(boxBasePropsSchema['x-registryName']).toBe('Box');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(boxBasePropsSchema.additionalProperties).toBe(false);
  });

  it('единственный сериализуемый проп — className (children приходит из children[])', () => {
    expect(Object.keys(boxBasePropsSchema.properties)).toEqual(['className']);
  });
});
