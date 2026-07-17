import { describe, it, expect } from 'vitest';
import { sliderBasePropsSchema } from './variants/base/slider-base.props';
import type { SliderFieldProps } from './variants/base/slider-base.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 *
 * Тип варианта — value-based `SliderFieldProps` (base — Radix `value: number[]` /
 * `onValueChange`, не скаляр; поэтому страж смотрит на field-контракт, а не на примитив).
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof sliderBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof sliderBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props field-контракта (нет опечаток/чужих ключей). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof SliderFieldProps ? true : false>;

describe('slider props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(sliderBasePropsSchema.properties);
    const runtimeKeys = Object.keys(sliderBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Slider (на него смотрит алиас SliderField)', () => {
    expect(sliderBasePropsSchema['x-registryName']).toBe('Slider');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(sliderBasePropsSchema.additionalProperties).toBe(false);
  });
});
