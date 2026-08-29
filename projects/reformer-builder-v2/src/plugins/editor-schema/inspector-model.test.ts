/**
 * Тесты модели инспектора: отбор свойств каталогом и выбор элемента управления.
 *
 * @module plugins/editor-schema/inspector-model.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { CatalogEntry } from '@/lib/catalog/types';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { ensureNodeIds, type NodeIdFactory } from '@/lib/form-model/node-id';
import { editorFor, inspectorModelFor, inspectorModelOf } from './inspector-model';
import { indexNodes } from './node-index';

function sequentialIds(): NodeIdFactory {
  let counter = 0;
  return () => `a${String((counter += 1)).padStart(7, '0')}`;
}

const PROPS_SCHEMA = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Подпись поля',
      'x-doc': { group: 'Control', type: 'string' },
    },
    className: { type: 'string', 'x-doc': { group: 'Control', type: 'string' } },
    size: { enum: ['sm', 'lg'], 'x-doc': { group: 'Control', type: 'string' } },
    options: { type: 'array', 'x-doc': { group: 'Options', type: 'unknown[]' } },
    maxLength: {
      type: 'number',
      default: 10,
      minimum: 1,
      maximum: 99,
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    required: { type: 'boolean', 'x-doc': { group: 'State', type: 'boolean' } },
  },
} as unknown as PropsSchema;

const CATALOG: readonly CatalogEntry[] = [
  {
    name: 'Select',
    role: 'field',
    propsSchema: PROPS_SCHEMA,
    makeNode: () => ({ value: '$model(x)', component: '$component(Select)' }),
  },
];

const SCHEMA: JsonFormSchema = ensureNodeIds(sampleSchema(), sequentialIds());
const SELECT_PATH = ['root', 'componentProps', 'steps', 0, 'children', 0];

function selectId(): string {
  const id = indexNodes(SCHEMA).idAt(SELECT_PATH);
  if (id === undefined) throw new Error('в фикстуре нет поля Select');
  return id;
}

describe('editorFor', () => {
  it('переводит вид свойства из каталога в элемент управления', () => {
    expect(editorFor('boolean')).toBe('checkbox');
    expect(editorFor('enum')).toBe('select');
    expect(editorFor('number')).toBe('number');
    expect(editorFor('text')).toBe('text');
    // Специализированные редакторы — отдельные работы; до них значение только на чтение.
    expect(editorFor('dataSource')).toBe('readonly');
    expect(editorFor('readonly')).toBe('readonly');
    // …кроме классов и значков: голого текста им пока хватает.
    expect(editorFor('className')).toBe('text');
    expect(editorFor('icon')).toBe('text');
  });
});

describe('inspectorModelFor', () => {
  it('берёт поля из каталожной записи выделенного узла', () => {
    const model = inspectorModelFor(SCHEMA, CATALOG, [selectId()]);
    expect(model?.known).toBe(true);
    expect(model?.sections.map((s) => s.group)).toEqual([
      'Control',
      'Options',
      'Behavior',
      'State',
    ]);
    expect(model?.sections[0].fields.map((f) => f.key)).toEqual(['label', 'className', 'size']);
  });

  it('назначает элемент управления по виду свойства', () => {
    const model = inspectorModelFor(SCHEMA, CATALOG, [selectId()]);
    const editors = new Map(
      model?.sections.flatMap((s) => s.fields.map((f) => [f.key, f.editor] as const))
    );
    expect(editors.get('label')).toBe('text');
    expect(editors.get('size')).toBe('select');
    expect(editors.get('required')).toBe('checkbox');
    expect(editors.get('maxLength')).toBe('number');
    expect(editors.get('options')).toBe('readonly');
  });

  it('читает значение из узла и НЕ подставляет умолчание каталога', () => {
    const model = inspectorModelFor(SCHEMA, CATALOG, [selectId()]);
    const fields = new Map(
      model?.sections.flatMap((s) => s.fields.map((f) => [f.key, f] as const))
    );
    expect(fields.get('label')?.value).toBe('Тип кредита');
    expect(fields.get('maxLength')?.value).toBeUndefined();
    expect(fields.get('maxLength')?.fallback).toBe(10);
    expect(fields.get('maxLength')?.min).toBe(1);
    expect(fields.get('maxLength')?.max).toBe(99);
  });

  it('несёт подсказку и границы из схемы свойства', () => {
    const model = inspectorModelFor(SCHEMA, CATALOG, [selectId()]);
    expect(model?.sections[0].fields[0].description).toBe('Подпись поля');
  });

  it('показывает привязку поля и то, что оно привязываемо', () => {
    const model = inspectorModelFor(SCHEMA, CATALOG, [selectId()]);
    expect(model?.binding).toBe('loanType');
    expect(model?.bindable).toBe(true);
  });

  it('молчит при множественном выделении и при пустом', () => {
    expect(inspectorModelFor(SCHEMA, CATALOG, [])).toBeNull();
    expect(inspectorModelFor(SCHEMA, CATALOG, [selectId(), 'a0000002'])).toBeNull();
  });

  it('молчит, если выделенного узла в модели уже нет', () => {
    expect(inspectorModelFor(SCHEMA, CATALOG, ['zzzzzzzz'])).toBeNull();
  });
});

describe('inspectorModelOf', () => {
  it('признаётся, что компонента нет в каталоге, вместо пустых секций без объяснения', () => {
    const node = { value: '$model(x)', component: '$component(Неизвестный)' } as JsonNode;
    const model = inspectorModelOf(node, 'a0000001', CATALOG);
    expect(model.known).toBe(false);
    expect(model.sections).toEqual([]);
    expect(model.component).toBe('Неизвестный');
  });

  it('контейнер к модели формы не привязывается', () => {
    const node = { component: '$component(Box)', children: [] } as JsonNode;
    expect(inspectorModelOf(node, 'a0000001', CATALOG).bindable).toBe(false);
  });
});

describe('текстовое содержимое', () => {
  const container = (children: unknown[]): JsonNode =>
    ({ component: '$html(b)', children }) as unknown as JsonNode;

  it('узел без текста даёт пустое правимое поле, а не отсутствие поля', () => {
    const text = inspectorModelOf(container([]), 'abcd1234', []).text;
    expect(text).toEqual({ value: '', editable: true });
  });

  it('одна текстовая часть правится', () => {
    const text = inspectorModelOf(container(['Внимание']), 'abcd1234', []).text;
    expect(text).toEqual({ value: 'Внимание', editable: true });
  });

  it('несколько частей показываются, но не правятся: какую из них — инспектор не знает', () => {
    const node = container(['раз', { component: '$html(i)' }, 'два']);
    expect(inspectorModelOf(node, 'abcd1234', []).text).toEqual({
      value: 'раздва',
      editable: false,
    });
  });

  it('узел, не принимающий детей, поля не получает вовсе', () => {
    const field = { value: '$model(a)', component: '$component(Input)' } as unknown as JsonNode;
    expect(inspectorModelOf(field, 'abcd1234', []).text).toBeNull();
  });
});
