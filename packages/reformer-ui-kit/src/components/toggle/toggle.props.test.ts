import { describe, it, expect } from 'vitest';
import { toggleBasePropsSchema } from './variants/base/toggle-base.props';
import type { ToggleFieldProps } from './variants/base/toggle-base.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 *
 * Тип варианта — value-based `ToggleFieldProps` (base — Radix `pressed`/`onPressedChange`,
 * не `value`; поэтому страж смотрит на field-контракт, а не на примитив).
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof toggleBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof toggleBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props field-контракта (нет опечаток/чужих ключей). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof ToggleFieldProps ? true : false>;

describe('toggle props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(toggleBasePropsSchema.properties);
    const runtimeKeys = Object.keys(toggleBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Toggle (на него смотрит алиас ToggleField)', () => {
    expect(toggleBasePropsSchema['x-registryName']).toBe('Toggle');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(toggleBasePropsSchema.additionalProperties).toBe(false);
  });

  it('variant/size объявлены как enum-контролы', () => {
    expect(toggleBasePropsSchema.properties.variant.enum).toEqual(['default', 'outline']);
    expect(toggleBasePropsSchema.properties.size.enum).toEqual(['default', 'sm', 'lg']);
  });
});
