import { describe, it, expect } from 'vitest';
import { nativeSelectBasePropsSchema } from './variants/base/native-select-base.props';
import type { NativeSelectWithOptionsProps } from './variants/base/native-select-base.field';
import { nativeSelectMultiPropsSchema } from './variants/multi/native-select-multi.props';
import type { NativeSelectMultiFieldProps } from './variants/multi/native-select-multi.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof nativeSelectBasePropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof nativeSelectBasePropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props варианта (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof NativeSelectWithOptionsProps ? true : false>;

describe('native-select props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(nativeSelectBasePropsSchema.properties);
    const runtimeKeys = Object.keys(nativeSelectBasePropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = NativeSelect (на него смотрит алиас NativeSelectField)', () => {
    expect(nativeSelectBasePropsSchema['x-registryName']).toBe('NativeSelect');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(nativeSelectBasePropsSchema.additionalProperties).toBe(false);
  });
});

/**
 * Страж мульти-варианта. Отдельная запись каталога (`x-registryName: 'NativeSelectMulti'`).
 */
type MultiPropKeys = keyof typeof nativeSelectMultiPropsSchema.properties;
type MultiRuntimeKeys = keyof (typeof nativeSelectMultiPropsSchema)['x-runtimeProps'];
type MultiKeys = MultiPropKeys | MultiRuntimeKeys;

/** A: каждый ключ мульти-схемы существует в props мульти-контракта. */
type _A_MultiNoStrayKeys = Assert<
  MultiKeys extends keyof NativeSelectMultiFieldProps ? true : false
>;

describe('native-select-multi props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(nativeSelectMultiPropsSchema.properties);
    const runtimeKeys = Object.keys(nativeSelectMultiPropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = NativeSelectMulti (на него смотрит экспорт NativeSelectMultiField)', () => {
    expect(nativeSelectMultiPropsSchema['x-registryName']).toBe('NativeSelectMulti');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(nativeSelectMultiPropsSchema.additionalProperties).toBe(false);
  });

  it('значение объявлено массивом с пустым выбором null — контракт всех мультивыборов кита', () => {
    expect(nativeSelectMultiPropsSchema['x-runtimeProps'].value.type).toBe('string[] | null');
  });

  // Вынужденное расхождение с общим набором пропсов, зафиксированное тестом: в multiple-листбоксе
  // <option value=""> становится выбираемым мусорным пунктом, поэтому placeholder недопустим.
  it('placeholder отсутствует у мульти-варианта, но есть у одиночного', () => {
    expect('placeholder' in nativeSelectBasePropsSchema.properties).toBe(true);
    expect('placeholder' in nativeSelectMultiPropsSchema.properties).toBe(false);
  });
});

describe('группа вариантов NativeSelect', () => {
  it('обе схемы состоят в группе NativeSelect', () => {
    expect(nativeSelectBasePropsSchema['x-variantGroup']).toBe('NativeSelect');
    expect(nativeSelectMultiPropsSchema['x-variantGroup']).toBe('NativeSelect');
  });

  it('дефолт группы ровно один — тот, чьё имя совпало с именем группы', () => {
    const members = [nativeSelectBasePropsSchema, nativeSelectMultiPropsSchema];
    const defaults = members.filter((m) => m['x-registryName'] === m['x-variantGroup']);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]['x-registryName']).toBe('NativeSelect');
  });
});
