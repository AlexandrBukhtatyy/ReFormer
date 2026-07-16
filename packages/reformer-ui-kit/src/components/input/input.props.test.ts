import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { inputBasePropsSchema } from './variants/base/input-base.props';

/**
 * Страж от дрейфа. Для Input тип варианта — `React.ComponentProps<'input'>` (native, ~300 ключей),
 * поэтому доступно только направление A (ключи схемы ⊆ props): оно ловит опечатки/чужие ключи, но не
 * «непокрытые props» (их у native слишком много) — осознанное ограничение (§ Props-компаньоны, Риск №8).
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof inputBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof inputBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует среди props native input (нет опечаток/чужих ключей). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof React.ComponentProps<'input'> ? true : false>;

describe('input props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅', () => {
    const propKeys = Object.keys(inputBasePropsSchema.properties);
    const runtimeKeys = Object.keys(inputBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Input (алиас InputField)', () => {
    expect(inputBasePropsSchema['x-registryName']).toBe('Input');
  });

  it('type enum включает number и date (боевая форма использует type=date)', () => {
    expect(inputBasePropsSchema.properties.type.enum).toContain('number');
    expect(inputBasePropsSchema.properties.type.enum).toContain('date');
  });
});
