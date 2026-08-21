import { describe, it, expect } from 'vitest';
import { selectAsyncPropsSchema } from './variants/async/select-async.props';
import type { SelectAsyncProps } from './variants/async/select-async';
import { selectMultiPropsSchema } from './variants/multi/select-multi.props';
import type { SelectMultiFieldProps } from './variants/multi/select-multi.field';

/**
 * Страж от дрейфа схемы (фаза E2). Тип-левел часть (A) падает на `tsc`, НЕ на vitest
 * (esbuild транспилирует без проверки типов) — держать в tsc-scope.
 */

type Assert<T extends true> = T;

type SchemaPropKeys = keyof typeof selectAsyncPropsSchema.properties;
type SchemaRuntimeKeys = keyof (typeof selectAsyncPropsSchema)['x-runtimeProps'];
type SchemaKeys = SchemaPropKeys | SchemaRuntimeKeys;

/** A: каждый ключ схемы существует в props варианта (нет опечаток/удалённых props). */
type _A_NoStrayKeys = Assert<SchemaKeys extends keyof SelectAsyncProps ? true : false>;

describe('select-async props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(selectAsyncPropsSchema.properties);
    const runtimeKeys = Object.keys(selectAsyncPropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = Select (на него смотрит алиас SelectField)', () => {
    expect(selectAsyncPropsSchema['x-registryName']).toBe('Select');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(selectAsyncPropsSchema.additionalProperties).toBe(false);
  });
});

/**
 * Страж мульти-варианта. Отдельная запись каталога (`x-registryName: 'SelectMulti'`).
 */
type MultiPropKeys = keyof typeof selectMultiPropsSchema.properties;
type MultiRuntimeKeys = keyof (typeof selectMultiPropsSchema)['x-runtimeProps'];
type MultiKeys = MultiPropKeys | MultiRuntimeKeys;

/** A: каждый ключ мульти-схемы существует в props мульти-контракта. */
type _A_MultiNoStrayKeys = Assert<MultiKeys extends keyof SelectMultiFieldProps ? true : false>;

describe('select-multi props-схема — страж от дрейфа', () => {
  it('рантайм: properties ∩ x-runtimeProps = ∅ (проп не в двух местах)', () => {
    const propKeys = Object.keys(selectMultiPropsSchema.properties);
    const runtimeKeys = Object.keys(selectMultiPropsSchema['x-runtimeProps']);
    expect(propKeys.filter((k) => runtimeKeys.includes(k))).toEqual([]);
  });

  it('x-registryName = SelectMulti (на него смотрит экспорт SelectMultiField)', () => {
    expect(selectMultiPropsSchema['x-registryName']).toBe('SelectMulti');
  });

  it('additionalProperties: false (ловит опечатки componentProps)', () => {
    expect(selectMultiPropsSchema.additionalProperties).toBe(false);
  });

  it('значение объявлено массивом с пустым выбором null — контракт всех мультивыборов кита', () => {
    expect(selectMultiPropsSchema['x-runtimeProps'].value.type).toBe('string[] | null');
  });

  // resource требует функцию load — в JSON он невыразим и обязан жить в x-runtimeProps,
  // иначе DSL обещал бы то, чего задать нельзя. Тот же приём, что у одиночного варианта.
  it('resource — рантайм-проп, а не componentProps', () => {
    expect('resource' in selectMultiPropsSchema.properties).toBe(false);
    expect('resource' in selectMultiPropsSchema['x-runtimeProps']).toBe(true);
  });
});

describe('группа вариантов Select', () => {
  it('обе схемы состоят в группе Select', () => {
    expect(selectAsyncPropsSchema['x-variantGroup']).toBe('Select');
    expect(selectMultiPropsSchema['x-variantGroup']).toBe('Select');
  });

  it('дефолт группы ровно один — тот, чьё имя совпало с именем группы', () => {
    const members = [selectAsyncPropsSchema, selectMultiPropsSchema];
    const defaults = members.filter((m) => m['x-registryName'] === m['x-variantGroup']);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]['x-registryName']).toBe('Select');
  });
});
