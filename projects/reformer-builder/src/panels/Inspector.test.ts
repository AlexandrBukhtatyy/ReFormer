/**
 * Значения, которые инспектор пишет в `componentProps`, должны проходить гейт валидации
 * (`validateSchema` → `defaultPropSchemas` ui-kit). Тесты закрывают три случая, на которых панель
 * раньше писала невалидное: пустая опция `enum` (`''` нет ни в одном enum каталога), нечисловой
 * ввод в number-виджет (уходил строкой) и пустой текстовый ввод (оставлял `''`).
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { blankToUndefined, toNumberValue } from './inspector-value';
import { getCatalog, inspectorGroups } from '../catalog';
import { validateSchema } from '../io/validate';

/** Схема из одного поля с заданными `componentProps` — для прогона через гейт валидации. */
function schemaWithProps(component: string, props: Record<string, unknown>): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        { value: '$model(x)', component: `$component(${component})`, componentProps: props },
      ],
    },
  } as JsonFormSchema;
}

describe('toNumberValue', () => {
  it('число — числом', () => {
    expect(toNumberValue('42')).toBe(42);
    expect(toNumberValue('-1.5')).toBe(-1.5);
    expect(toNumberValue('1e3')).toBe(1000);
  });

  it('пустое и нечисловое — undefined (ключ удаляется, а не пишется строкой)', () => {
    expect(toNumberValue('')).toBeUndefined();
    expect(toNumberValue('  ')).toBeUndefined();
    expect(toNumberValue('-')).toBeUndefined();
    expect(toNumberValue('abc')).toBeUndefined();
    expect(toNumberValue('Infinity')).toBeUndefined();
  });
});

describe('blankToUndefined', () => {
  it('пустая строка — undefined, непустая — как есть', () => {
    expect(blankToUndefined('')).toBeUndefined();
    expect(blankToUndefined('outline')).toBe('outline');
  });
});

describe('записываемые инспектором значения проходят валидацию', () => {
  it("пустая опция enum не пишет '' (оно невалидно для каждого enum каталога)", () => {
    // Контроль допущения: пустой строки нет ни в одном enum — значит «не задано» может быть
    // выражено ТОЛЬКО отсутствием ключа.
    const enums = getCatalog().flatMap((e) =>
      inspectorGroups(e.propsSchema)
        .flatMap((g) => g.props)
        .filter((p) => p.widget === 'enum' && p.options?.includes(''))
        .map((p) => `${e.name}.${p.key}`)
    );
    expect(enums).toEqual([]);

    expect(validateSchema(schemaWithProps('Accordion', { type: '' })).valid).toBe(false);
    expect(validateSchema(schemaWithProps('Accordion', {})).valid).toBe(true);
  });

  it('нечисловой ввод не уходит в схему строкой', () => {
    expect(validateSchema(schemaWithProps('FileUpload', { maxFiles: '1e5' })).valid).toBe(false);
    expect(
      validateSchema(schemaWithProps('FileUpload', { maxFiles: toNumberValue('1e5') })).valid
    ).toBe(true);
  });

  it('границы minimum/maximum доходят до инспектора (min/max инпута)', () => {
    const maxFiles = inspectorGroups(getCatalog().find((e) => e.name === 'FileUpload')!.propsSchema)
      .flatMap((g) => g.props)
      .find((p) => p.key === 'maxFiles')!;
    expect(maxFiles.min).toBe(1);
    // Значение вне границы валидатор отвергает — поэтому инпут обязан их знать.
    expect(validateSchema(schemaWithProps('FileUpload', { maxFiles: 0 })).valid).toBe(false);
  });
});
