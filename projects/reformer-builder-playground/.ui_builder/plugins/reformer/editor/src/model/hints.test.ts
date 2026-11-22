import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { CatalogEntry } from '../../../core/catalog';
import { completeModelPath, formJsonSchema } from './hints';

const schema = {
  format: 2,
  root: {
    component: '$html(div)',
    children: [
      { model: '$model(fullName)', component: '$component(Input)' },
      { model: '$model(email)', component: '$component(Input)' },
      'Итого: ',
      {
        model: '$model(items)',
        item: {
          $template: {
            component: '$component(Box)',
            children: [{ model: '$model(price)', component: '$component(Input)' }],
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
      path: [...TEMPLATE, 'children', 0, 'model'],
      value: '$model()',
      offset: 7,
    });
    expect(items.map((item) => item.insert)).toEqual(['price']);
  });

  it('в начале значения привязки — оператор целиком', () => {
    const items = completeModelPath(schema, {
      path: ['root', 'children', 0, 'model'],
      value: '$m',
      offset: 2,
    });
    expect(items[0]).toMatchObject({
      label: '$model(fullName)',
      insert: '$model(fullName)',
      replace: { start: 0, end: 2 },
    });
  });

  it('оператор целиком — только в ключе model и только на начале оператора', () => {
    const at = (path: (string | number)[], value: string) =>
      completeModelPath(schema, { path, value, offset: value.length });
    expect(at(['root', 'component'], '$')).toEqual([]);
    expect(at(['root', 'children', 0, 'model'], 'abc')).toEqual([]);
    // Ключи прежнего формата привязкой больше не служат: `value` в формате 2 — обычный проп.
    expect(at(['root', 'children', 0, 'value'], '$m')).toEqual([]);
    expect(at(['root', 'children', 3, 'array'], '$m')).toEqual([]);
  });

  it('привязка массива — тот же ключ model, что у поля', () => {
    const items = completeModelPath(schema, {
      path: ['root', 'children', 3, 'model'],
      value: '',
      offset: 0,
    });
    expect(items.map((item) => item.insert)).toEqual([
      '$model(fullName)',
      '$model(email)',
      '$model(items)',
    ]);
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
      makeNode: () => ({ model: '$model(x)' }) as never,
    },
  ]);

  it('имена компонентов — enum оператора', () => {
    const { schema: meta } = formJsonSchema(catalog) as {
      schema: { definitions: { componentOp: { enum?: string[] } } };
    };
    expect(meta.definitions.componentOp.enum).toEqual(['$component(Input)']);
  });

  it('синтетика $html — не имя компонента, а ветка своего тега', () => {
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
    // Ветки по имени визарда больше нет: шаги — его `children`, их схема разбирает сама.
    expect(branches).not.toContain('$component(Wizard)');
  });

  it('схема — формата 2: привязка в model, шаги мастера — узлы и ссылки в children', () => {
    const { schema: meta } = formJsonSchema(catalog) as {
      schema: {
        required: string[];
        properties: { format: { const: number } };
        definitions: {
          fieldNode: { required: string[]; properties: Record<string, unknown> };
          arrayNode: { required: string[] };
          containerNode: {
            properties: {
              children: { items: { then: { then: { $ref: string }; else: { $ref: string } } } };
            };
          };
          stepRef: { properties: { $ref: { description?: string } } };
        };
      };
    };
    expect(meta.required).toContain('format');
    expect(meta.properties.format.const).toBe(2);
    expect(meta.definitions.fieldNode.required).toEqual(['model']);
    expect(meta.definitions.fieldNode.properties).not.toHaveProperty('value');
    expect(meta.definitions.arrayNode.required).toEqual(['model', 'item']);

    // Ребёнок-объект любого контейнера, включая визард, — узел либо ссылка на файл шага:
    // поэтому внутри шага подсказки те же, что везде, и отдельной ветки для шагов не нужно.
    const child = meta.definitions.containerNode.properties.children.items.then;
    expect(child.then.$ref).toBe('#/definitions/stepRef');
    expect(child.else.$ref).toBe('#/definitions/node');
    expect(meta.definitions.stepRef.properties.$ref.description).toContain('./steps/');
  });

  it('тот же каталог — тот же ответ, другой — другой адрес', () => {
    const first = formJsonSchema(catalog);
    expect(formJsonSchema(catalog)).toBe(first);
    expect(formJsonSchema(Object.freeze([...catalog])).uri).not.toBe(first.uri);
  });
});
