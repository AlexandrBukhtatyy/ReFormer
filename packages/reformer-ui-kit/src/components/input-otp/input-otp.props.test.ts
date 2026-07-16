import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { inputOtpBasePropsSchema } from './variants/base/input-otp-base.props';
import { InputOTP } from './variants/base/input-otp-base';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 *
 * Тип props `InputOTP` — union (`OTPInputProps`, ~сотни ключей от InputHTMLAttributes), поэтому
 * доступно только направление A (ключи схемы ⊆ props): ловит опечатки/чужие ключи.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof inputOtpBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof inputOtpBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует среди props InputOTP (нет опечаток/чужих ключей). */
type _A_NoStrayKeys = Assert<
  SchemaKeys extends keyof React.ComponentProps<typeof InputOTP> ? true : false
>;

describe('input-otp props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(inputOtpBasePropsSchema.properties);
    const runtimeKeys = Object.keys(inputOtpBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = InputOTP (на него смотрит алиас InputOTPField)', () => {
    expect(inputOtpBasePropsSchema['x-registryName']).toBe('InputOTP');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(inputOtpBasePropsSchema.additionalProperties).toBe(false);
  });
});
