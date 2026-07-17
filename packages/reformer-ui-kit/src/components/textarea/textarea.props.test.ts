import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { textareaBasePropsSchema } from './variants/base/textarea-base.props';

/**
 * Страж от дрейфа. Тип варианта — `React.ComponentProps<'textarea'>` (native, много ключей),
 * поэтому доступно только направление A (ключи схемы ⊆ props): ловит опечатки/чужие ключи, но не
 * «непокрытые props» (их у native слишком много) — как у Input.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof textareaBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof textareaBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует среди props native textarea (нет опечаток/чужих ключей). */
type _A_NoStrayKeys = Assert<
  SchemaKeys extends keyof React.ComponentProps<'textarea'> ? true : false
>;

describe('textarea props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅', () => {
    const propKeys = Object.keys(textareaBasePropsSchema.properties);
    const runtimeKeys = Object.keys(textareaBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Textarea (алиас TextareaField)', () => {
    expect(textareaBasePropsSchema['x-registryName']).toBe('Textarea');
  });
});
