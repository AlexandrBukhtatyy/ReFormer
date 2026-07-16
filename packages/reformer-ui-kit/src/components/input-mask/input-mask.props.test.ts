import { describe, it, expect } from 'vitest';
import { inputMaskBasePropsSchema } from './variants/base/input-mask-base.props';
import type { InputMaskProps } from './variants/base/input-mask-base';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof inputMaskBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof inputMaskBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props InputMask (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof InputMaskProps ? true : false>;

describe('input-mask props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(inputMaskBasePropsSchema.properties);
    const runtimeKeys = Object.keys(inputMaskBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = InputMask (на него смотрит алиас InputMaskField)', () => {
    expect(inputMaskBasePropsSchema['x-registryName']).toBe('InputMask');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(inputMaskBasePropsSchema.additionalProperties).toBe(false);
  });
});
