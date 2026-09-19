import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import { completeModelPath, formJsonSchema } from './hints';

const schema = {
  root: {
    component: '$html(div)',
    children: [
      { value: '$model(fullName)', component: '$component(Input)' },
      { value: '$model(email)', component: '$component(Input)' },
      'Итого: ',
      {
        array: '$model(items)',
        item: {
          $template: {
            component: '$component(Box)',
            children: [{ value: '$model(price)', component: '$component(Input)' }],
          },
        },
      },
    ],
  },
} as JsonFormSchema;

const TEMPLATE = ['root', 'children', 3, 'item', '$template'];

describe('completeModelPath', () => {
  it('внутри скобок — пути области, заменяется аргумент целиком', () => {
    const items = completeModelPath(schema, {
      path: ['root', 'children', 2],
      value: '$model(fu)',
      offset: 9,
    });
    expect(items.map((item) => item.insert)).toEqual(['fullName', 'email', 'items']);
    expect(items[0].replace).toEqual({ start: 7, end: 9 });
  });

  it('незакрытая скобка — до конца строки', () => {
    const [item] = completeModelPath(schema, { path: ['x'], value: '$model(', offset: 7 });
    expect(item.replace).toEqual({ start: 7, end: 7 });
  });

  it('внутри шаблона массива — пути элемента', () => {
    const items = completeModelPath(schema, {
      path: [...TEMPLATE, 'children', 0, 'value'],
      value: '$model()',
      offset: 7,
    });
    expect(items.map((item) => item.insert)).toEqual(['price']);
  });

  it('в начале значения привязки — оператор целиком', () => {
    const items = completeModelPath(schema, {
      path: ['root', 'children', 0, 'value'],
      value: '$m',
      offset: 2,
    });
    expect(items[0]).toMatchObject({
      label: '$model(fullName)',
      insert: '$model(fullName)',
      replace: { start: 0, end: 2 },
    });
  });

  it('оператор целиком — только в value/array и только на начале оператора', () => {
    const at = (path: (string | number)[], value: string) =>
      completeModelPath(schema, { path, value, offset: value.length });
    expect(at(['root', 'component'], '$')).toEqual([]);
    expect(at(['root', 'children', 0, 'value'], 'abc')).toEqual([]);
  });

  it('курсор за закрывающей скобкой — ничего', () => {
    expect(completeModelPath(schema, { path: ['x'], value: '$model(email) ', offset: 14 })).toEqual(
      []
    );
  });
});

describe('formJsonSchema', () => {
  const catalog: readonly CatalogEntry[] = Object.freeze([
    {
      name: 'Input',
      role: 'field',
      propsSchema: { type: 'object', properties: { placeholder: { type: 'string' } } },
      makeNode: () => ({ value: '$model(x)' }) as never,
    },
  ]);

  it('имена компонентов — enum оператора', () => {
    const { schema: meta } = formJsonSchema(catalog) as {
      schema: { definitions: { componentOp: { enum?: string[] } } };
    };
    expect(meta.definitions.componentOp.enum).toEqual(['$component(Input)']);
  });

  it('синтетика $html — не имя компонента, а ветка своего тега; шаги мастера — узлы', () => {
    const withHtml: readonly CatalogEntry[] = Object.freeze([
      ...catalog,
      {
        name: '$html(div)',
        role: 'container',
        propsSchema: { type: 'object', properties: { className: { type: 'string' } } },
        makeNode: () => ({ component: '$html(div)' }) as never,
      },
    ]);
    const { schema: meta } = formJsonSchema(withHtml) as {
      schema: {
        definitions: {
          componentOp: { enum?: string[] };
          containerNode: { allOf: { if: { properties: { component: { const: string } } } }[] };
        };
      };
    };
    expect(meta.definitions.componentOp.enum).toEqual(['$component(Input)']);
    const branches = meta.definitions.containerNode.allOf.map(
      (branch) => branch.if.properties.component.const
    );
    expect(branches).toContain('$html(div)');
    expect(branches).toContain('$component(Wizard)');
  });

  it('тот же каталог — тот же ответ, другой — другой адрес', () => {
    const first = formJsonSchema(catalog);
    expect(formJsonSchema(catalog)).toBe(first);
    expect(formJsonSchema(Object.freeze([...catalog])).uri).not.toBe(first.uri);
  });
});
