import { describe, it, expect } from 'vitest';
import { inputPasswordBasePropsSchema } from './variants/base/input-password-base.props';
import type { InputPasswordProps } from './variants/base/input-password-base';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof inputPasswordBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof inputPasswordBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props компонента (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof InputPasswordProps ? true : false>;

describe('input-password props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(inputPasswordBasePropsSchema.properties);
    const runtimeKeys = Object.keys(inputPasswordBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = InputPassword (на него смотрит алиас InputPasswordField)', () => {
    expect(inputPasswordBasePropsSchema['x-registryName']).toBe('InputPassword');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(inputPasswordBasePropsSchema.additionalProperties).toBe(false);
  });
});
