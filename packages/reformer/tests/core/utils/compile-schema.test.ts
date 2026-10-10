/**
 * Компилятор схемы: вид каждого узла, идентификаторы и области, индексы полей и массивов.
 *
 * Компиляцию читают и сборка формы, и рендереры, поэтому здесь закреплено то, на что они
 * опираются: детерминированные идентификаторы, уникальность `selector` в области и области строк,
 * которые не меняются при перестановке.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { InputStub, SectionStub } from '../../test-utils/stubs';
import { compileSchema, isCompiledNode } from '../../../src/form/schema/compile';
import type {
  CompiledArrayNode,
  CompiledContainerNode,
  CompiledPartNode,
  SchemaNodeId,
} from '../../../src/form/schema/compiled';
import { createModel, type FormModel } from '../../../src/model/index';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

interface Address {
  city: string;
}
interface Phone {
  number: string;
  address: Address;
}
interface Shape {
  title: string;
  tags: string[];
  home: Address;
  phones: Phone[];
}

const createShape = () =>
  createModel<Shape>({
    title: '',
    tags: [],
    home: { city: '' },
    phones: [
      { number: '1', address: { city: 'a' } },
      { number: '2', address: { city: 'b' } },
    ],
  });

const address = (model: FormModel<Address>): FormSchemaNode => ({
  selector: 'city',
  model: model.$.city,
  component: InputStub,
});

const phoneRow = (model: FormModel<Phone>): FormSchemaNode => ({
  selector: 'row',
  children: [
    { selector: 'number', model: model.$.number, component: InputStub },
    { model: model.$.address, part: address },
  ],
});

const schemaOf = (model: FormModel<Shape>): FormSchemaNode => ({
  selector: 'root',
  component: SectionStub,
  children: [
    'Заголовок: ',
    model.$.title,
    { selector: 'title', model: model.$.title, component: InputStub, disabled: true },
    { model: model.$.tags, component: InputStub },
    { selector: 'home', model: model.$.home, part: address },
    { selector: 'phones', model: model.$.phones, item: phoneRow, initialValue: { number: '' } },
    { children: [{ component: 'hr' }] },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('compileSchema — виды узлов', () => {
  it('поле, массив, подформа, контейнер и текст', () => {
    const model = createShape();
    const compiled = compileSchema(schemaOf(model), model);
    const root = compiled.root as CompiledContainerNode;

    expect(root.kind).toBe('container');
    expect(root.children.map((child) => child.kind)).toEqual([
      'text',
      'field',
      'field',
      'part',
      'array',
      'container',
    ]);
  });

  it('подряд идущие текстовые дети склеиваются в один текст', () => {
    const model = createShape();
    const root = compileSchema(schemaOf(model), model).root as CompiledContainerNode;
    const [text] = root.children;

    expect(text).toEqual({ kind: 'text', id: '#/0', parts: ['Заголовок: ', model.$.title] });
  });

  it('поле несёт ручку, компонент, пропсы и отключение', () => {
    const model = createShape();
    const compiled = compileSchema(schemaOf(model), model);
    const title = compiled.fields.get(model.$.title);

    expect(title).toMatchObject({
      kind: 'field',
      id: 'title',
      handle: model.$.title,
      component: InputStub,
      disabled: true,
    });
    expect(compiled.fields.get(model.$.tags)?.disabled).toBe(false);
  });

  it('привязка массива фасадом нормализуется к ручке', () => {
    const model = createShape();
    const compiled = compileSchema(
      { model: model.phones as never, item: phoneRow } as FormSchemaNode,
      model
    );

    expect(compiled.root).toMatchObject({ kind: 'array', handle: model.$.phones });
    expect((compiled.root as CompiledArrayNode).control).toBe(model.phones);
  });

  it('контейнер без компонента и без детей — тоже контейнер', () => {
    const model = createShape();
    const compiled = compileSchema({ selector: 'empty' }, model);

    expect(compiled.root).toMatchObject({ kind: 'container', component: undefined, children: [] });
  });

  it('пустые дети (`cond && узел`) пропускаются', () => {
    const model = createShape();
    const root = compileSchema(
      { children: [false, null, undefined, { component: 'hr' }] as never },
      model
    ).root as CompiledContainerNode;

    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({ kind: 'container', id: '#/3' });
  });

  it('узлы компиляции отличаются от авторских', () => {
    const model = createShape();
    const tree = schemaOf(model);
    const compiled = compileSchema(tree, model);

    expect(isCompiledNode(compiled.root)).toBe(true);
    expect(isCompiledNode(tree)).toBe(false);
    expect(compiled.root.source).toBe(tree);
  });
});

describe('compileSchema — идентификаторы', () => {
  it('идентификатор — selector, иначе позиционный путь; повторная компиляция даёт те же', () => {
    const model = createShape();
    const ids = (): string[] => [...compileSchema(schemaOf(model), model).nodes.keys()];

    expect(ids()).toEqual(['title', '#/3', 'home', 'phones', '#/6/0', '#/6', 'root']);
    expect(ids()).toEqual(ids());
  });

  it('узлы подформы лежат в её области, поля подформы — в индексе родителя', () => {
    const model = createShape();
    const compiled = compileSchema(schemaOf(model), model);
    const home = compiled.nodes.get('home' as SchemaNodeId) as CompiledPartNode;

    expect(compiled.nodes.has('city' as SchemaNodeId)).toBe(false);
    expect(home.content.scope).toBe('#/home');
    expect(home.content.nodes.get('city' as SchemaNodeId)?.kind).toBe('field');
    expect(compiled.fields.get(model.home.$.city)).toBe(home.content.root);
  });

  it('повтор selector в области — исключение с путями обоих узлов', () => {
    const model = createShape();

    expect(() =>
      compileSchema(
        {
          children: [
            { selector: 'title', model: model.$.title, component: InputStub },
            { children: [{ selector: 'title', component: SectionStub }] },
          ],
        },
        model
      )
    ).toThrow('в области «#» селектор «title» повторяется — узлы #/0 и #/1/0');
  });

  it('одинаковый selector в корне, в подформе и в строках массива — не повтор', () => {
    const model = createShape();
    const compiled = compileSchema(
      {
        children: [
          { selector: 'city', model: model.$.title, component: InputStub },
          { selector: 'number', component: SectionStub },
          { model: model.$.home, part: address },
          { model: model.$.phones, item: phoneRow },
        ],
      },
      model
    );
    const phones = compiled.arrays.get(model.$.phones)!;

    const rows = [0, 1].map((index) => phones.row(model.phones.at(index)!));
    expect(rows.map((row) => row.nodes.get('number' as SchemaNodeId)?.kind)).toEqual([
      'field',
      'field',
    ]);
  });

  it('узел внутри самого себя — исключение', () => {
    const cyclic: { children: unknown[] } = { children: [] };
    cyclic.children.push(cyclic);

    expect(() => compileSchema(cyclic as FormSchemaNode)).toThrow('дерево схемы зациклено');
  });
});

describe('compileSchema — строки массива', () => {
  it('схема строки компилируется один раз на под-модель строки', () => {
    const model = createShape();
    const item = vi.fn(phoneRow);
    const phones = compileSchema({ model: model.$.phones, item }, model).root as CompiledArrayNode;
    const first = model.phones.at(0)!;

    expect(phones.row(first)).toBe(phones.row(first));
    expect(item).toHaveBeenCalledTimes(1);
    expect(phones.row(model.phones.at(1)!)).not.toBe(phones.row(first));
  });

  it('область строки держится за строку, а не за индекс: move и swap её не меняют', () => {
    const model = createShape();
    const phones = compileSchema({ model: model.$.phones, item: phoneRow }, model)
      .root as CompiledArrayNode;
    const [first, second] = [model.phones.at(0)!, model.phones.at(1)!];
    const scopes = [phones.row(first).scope, phones.row(second).scope];

    model.phones.move(0, 1);
    expect(model.phones.at(1)).toBe(first);
    expect([phones.row(first).scope, phones.row(second).scope]).toEqual(scopes);

    model.phones.swap(0, 1);
    expect([phones.row(first).scope, phones.row(second).scope]).toEqual(scopes);
    expect(scopes[0]).toMatch(/^#\/phones\[\d+\]$/);
    expect(scopes[0]).not.toBe(scopes[1]);
  });

  it('подформа внутри строки — область относительно строки', () => {
    const model = createShape();
    const phones = compileSchema({ model: model.$.phones, item: phoneRow }, model)
      .root as CompiledArrayNode;
    const row = phones.row(model.phones.at(1)!);
    const part = [...row.nodes.values()].find((node) => node.kind === 'part') as CompiledPartNode;

    expect(part.content.scope).toBe(`${row.scope}/address`);
    expect(row.fields.get(model.phones.at(1)!.address.$.city)?.kind).toBe('field');
  });
});

describe('compileSchema — предупреждения', () => {
  it('нераспознанная привязка — контейнер с предупреждением', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();

    const compiled = compileSchema(
      { model: model.home as never, component: InputStub } as FormSchemaNode,
      model
    );

    expect(compiled.root.kind).toBe('container');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('привязка узла не распознана'));
  });

  it('группа модели ребёнком контейнера пропускается с предупреждением', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();

    const root = compileSchema({ children: [model.$.home as never] }, model)
      .root as CompiledContainerNode;

    expect(root.children).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('не узел и не текст'));
  });
});
