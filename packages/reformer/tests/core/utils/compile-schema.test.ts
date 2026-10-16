/**
 * Компилятор схемы: вид каждого узла, идентификаторы и области, индексы полей и массивов.
 *
 * Компиляцию читают и сборка формы, и рендереры, поэтому здесь закреплено то, на что они
 * опираются: детерминированные идентификаторы, уникальность `selector` в области и области строк,
 * которые не меняются при перестановке. Отдельно — то, что компилятор делает с ошибками автора:
 * привязка не своего вида, цикл в дереве, корень области не узел, прод-режим без предупреждений, и
 * зонды краевых деревьев (одна ручка в двух полях, цикл через подформу, `selector`, совпавший с
 * позиционным путём).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { signal } from '@preact/signals-core';
import { InputStub, SectionStub } from '../../test-utils/stubs';
import { compileSchema, isCompiledNode } from '../../../src/form/schema/compile';
import { rowKeyOf } from '../../../src/form/schema/row-key';
import type {
  CompiledArrayNode,
  CompiledContainerNode,
  CompiledFieldNode,
  CompiledNode,
  CompiledPartNode,
  CompiledSchema,
  SchemaNodeId,
  SchemaScopeId,
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

/** Узел области по идентификатору (`SchemaNodeId` — строка с брендом). */
const nodeOf = (nodes: ReadonlyMap<SchemaNodeId, CompiledNode>, id: string) =>
  nodes.get(id as SchemaNodeId);

/** Заглушить dev-предупреждения и вернуть шпиона. */
const muteWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

/** Тексты предупреждений, которые уже выдал шпион. */
const warningsOf = (warn: ReturnType<typeof muteWarnings>): string[] =>
  warn.mock.calls.map(([message]) => String(message));

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

describe('compileSchema — привязка не своего вида', () => {
  it.each([
    ['ручке листа', (model: FormModel<Shape>): unknown => model.$.title],
    ['ручке массива', (model: FormModel<Shape>): unknown => model.$.phones],
  ])('`part` на %s — контейнер с предупреждением, билдер части не зовётся', (_kind, bindingOf) => {
    const warn = muteWarnings();
    const model = createShape();
    const part = vi.fn(address);

    const compiled = compileSchema(
      {
        children: [{ selector: 'block', model: bindingOf(model), part }],
      } as unknown as FormSchemaNode,
      model
    );

    expect(nodeOf(compiled.nodes, 'block')).toMatchObject({ kind: 'container', children: [] });
    expect(part).not.toHaveBeenCalled();
    expect([compiled.fields.size, compiled.arrays.size]).toEqual([0, 0]);
    expect(warningsOf(warn)).toEqual([
      expect.stringContaining('у узла с `part` привязка — не группа модели (узел #/0)'),
    ]);
  });

  it('`item` на группе и на массиве из начального `null` — контейнер без строк', () => {
    const warn = muteWarnings();
    // Массив, созданный из `null`, в модели — лист: строк у него нет.
    const model = createModel<{ home: Address; phones: Phone[] | null }>({
      home: { city: '' },
      phones: null,
    });
    const item = vi.fn(phoneRow);

    const root = compileSchema(
      {
        children: [
          { model: model.$.home, item },
          { model: model.$.phones, item },
        ],
      } as unknown as FormSchemaNode,
      model
    ).root as CompiledContainerNode;

    expect(root.children.map((child) => child.kind)).toEqual(['container', 'container']);
    expect(item).not.toHaveBeenCalled();
    expect(warningsOf(warn)).toEqual([
      expect.stringContaining('у узла с `item` привязка — не массив модели (узел #/0)'),
      expect.stringContaining('у узла с `item` привязка — не массив модели (узел #/1)'),
    ]);
  });

  it('компонент и под-модель ребёнком контейнера пропускаются с предупреждением и рвут текст', () => {
    const warn = muteWarnings();
    const model = createShape();

    const root = compileSchema(
      { children: ['до', InputStub, model.home, 'после'] } as unknown as FormSchemaNode,
      model
    ).root as CompiledContainerNode;

    expect(root.children).toEqual([
      { kind: 'text', id: '#/0', parts: ['до'] },
      { kind: 'text', id: '#/3', parts: ['после'] },
    ]);
    expect(warningsOf(warn)).toEqual([
      expect.stringContaining('ребёнок #/1 — не узел и не текст'),
      expect.stringContaining('ребёнок #/2 — не узел и не текст'),
    ]);
  });

  it('чужой объект с `__kind: array` вместо ручки — TypeError modelOf, а не тихий контейнер', () => {
    // Массив компилятор узнаёт по `__kind`; узла модели за подделкой нет, и фасад для `control`
    // не находится. Это единственный путь к запасному позиционному пути области строк.
    const fake = { __kind: 'array' };

    expect(() =>
      compileSchema({ model: fake, item: () => ({}) } as unknown as FormSchemaNode)
    ).toThrow(/modelOf: ожидалась ручка группы или массива/);
  });
});

describe('compileSchema — текст', () => {
  it('склеиваются строка, число, сигнал листа, ручка массива и свой сигнал; узел текст рвёт', () => {
    const model = createShape();
    const own = signal('!');

    const root = compileSchema(
      {
        children: [
          'Итого: ',
          2,
          null,
          model.$.title,
          model.$.tags,
          { component: 'hr' },
          own,
          false,
          ' конец',
        ] as never,
      },
      model
    ).root as CompiledContainerNode;

    // Пустые места (`null`, `false`) текст не рвут; идентификатор текста — путь первой части.
    expect(root.children).toEqual([
      { kind: 'text', id: '#/0', parts: ['Итого: ', 2, model.$.title, model.$.tags] },
      expect.objectContaining({ kind: 'container', id: '#/5' }),
      { kind: 'text', id: '#/6', parts: [own, ' конец'] },
    ]);
  });
});

describe('compileSchema — isCompiledNode', () => {
  it('узлы компилятора — и в подформе, и в строке; текст, копия узла и схема — нет', () => {
    const model = createShape();
    const compiled = compileSchema(schemaOf(model), model);
    const root = compiled.root as CompiledContainerNode;
    const home = nodeOf(compiled.nodes, 'home') as CompiledPartNode;
    const row = compiled.arrays.get(model.$.phones)!.row(model.phones.at(0)!);

    expect([home.content.root, row.root, nodeOf(row.nodes, 'number')].map(isCompiledNode)).toEqual([
      true,
      true,
      true,
    ]);
    // Текст — ребёнок контейнера, а не узел: в набор узлов компилятора он не входит.
    expect(
      [root.children[0], { ...compiled.root }, compiled, null, undefined, 'title', 0].map(
        isCompiledNode
      )
    ).toEqual([false, false, false, false, false, false, false]);
  });
});

describe('compileSchema — циклы и повторное использование узла', () => {
  it('один объект узла дважды среди соседей — два узла с разными путями, это не цикл', () => {
    const model = createShape();
    const shared = { component: 'hr' };

    const compiled = compileSchema({ children: [shared, { children: [shared] }] }, model);

    const first = nodeOf(compiled.nodes, '#/0');
    const second = nodeOf(compiled.nodes, '#/1/0');
    expect(first?.source).toBe(shared);
    expect(second?.source).toBe(shared);
    expect(first).not.toBe(second);
  });

  it('тот же объект узла с selector дважды в области — повтор селектора', () => {
    const model = createShape();
    const shared = { selector: 'divider', component: 'hr' };

    expect(() => compileSchema({ children: [shared, { children: [shared] }] }, model)).toThrow(
      'в области «#» селектор «divider» повторяется — узлы #/0 и #/1/0'
    );
  });

  it('цикл через несколько уровней — исключение с путём повторного входа', () => {
    const outer: { children: unknown[] } = { children: [] };
    outer.children.push({ children: [outer] });

    expect(() => compileSchema(outer as FormSchemaNode)).toThrow(
      'узел #/0/0 содержит сам себя — дерево схемы зациклено'
    );
  });
});

describe('compileSchema — строки массива: компиляция по требованию', () => {
  it('строка компилируется при первом обращении, а не при компиляции схемы и не при push', () => {
    const model = createShape();
    const item = vi.fn(phoneRow);
    const phones = compileSchema({ model: model.$.phones, item }, model).root as CompiledArrayNode;

    model.phones.push({ number: '3', address: { city: 'c' } });
    expect(item).not.toHaveBeenCalled();

    const added = model.phones.at(2)!;
    const row = phones.row(added);
    expect(item).toHaveBeenCalledTimes(1);
    expect(item).toHaveBeenCalledWith(added);
    expect(phones.row(added)).toBe(row);
  });

  it('у каждой компиляции свой кэш строк, а поддерево строки и её область — общие', () => {
    const model = createShape();
    const tree: FormSchemaNode = { model: model.$.phones, item: phoneRow };
    const first = compileSchema(tree, model).root as CompiledArrayNode;
    const second = compileSchema(tree, model).root as CompiledArrayNode;
    const rowModel = model.phones.at(0)!;

    expect(second.row(rowModel)).not.toBe(first.row(rowModel));
    expect(second.row(rowModel).root.source).toBe(first.row(rowModel).root.source);
    expect(second.row(rowModel).scope).toBe(first.row(rowModel).scope);
  });
});

describe('compileSchema — идентификаторы областей', () => {
  it('корень — `#`; опция `scope` переносит корень и все области под ним', () => {
    const model = createShape();
    const tree: FormSchemaNode = {
      children: [
        { selector: 'home', model: model.$.home, part: address },
        { model: model.$.phones, item: phoneRow },
      ],
    };
    const rowModel = model.phones.at(0)!;

    const byDefault = compileSchema(tree, model);
    const custom = compileSchema(tree, model, { scope: '#/inner' as SchemaScopeId });

    expect([byDefault.scope, byDefault.root.scope]).toEqual(['#', '#']);
    expect([custom.scope, custom.root.scope]).toEqual(['#/inner', '#/inner']);
    expect((nodeOf(custom.nodes, 'home') as CompiledPartNode).content.scope).toBe('#/inner/home');
    expect(custom.arrays.get(model.$.phones)!.row(rowModel).scope).toBe(
      `#/inner/phones[${rowKeyOf(rowModel)}]`
    );
  });

  it('строка — `#/<массив>[<ключ строки>]`; подформа и массив в строке — от области строки', () => {
    interface Office {
      city: string;
    }
    interface Contact {
      office: Office;
      phones: { number: string }[];
    }
    const model = createModel<{ contacts: Contact[] }>({
      contacts: [{ office: { city: '' }, phones: [{ number: '1' }] }],
    });
    const contactRow = (row: FormModel<Contact>): FormSchemaNode => ({
      children: [
        { model: row.$.office, part: (office: FormModel<Office>) => ({ model: office.$.city }) },
        {
          model: row.$.phones,
          item: (phone: FormModel<{ number: string }>) => ({ model: phone.$.number }),
        },
      ],
    });
    const contacts = compileSchema({ model: model.$.contacts, item: contactRow }, model)
      .root as CompiledArrayNode;
    const contact = model.contacts.at(0)!;
    const phone = contact.phones.at(0)!;

    const row = contacts.row(contact);
    const [office, phones] = (row.root as CompiledContainerNode).children as [
      CompiledPartNode,
      CompiledArrayNode,
    ];

    expect(row.scope).toBe(`#/contacts[${rowKeyOf(contact)}]`);
    expect(office.content.scope).toBe(`${row.scope}/office`);
    expect(phones.row(phone).scope).toBe(`${row.scope}/phones[${rowKeyOf(phone)}]`);
    // Идентификаторы узлов в области строки — от её корня, а не от корня сборки.
    expect([...row.nodes.keys()]).toEqual(['#/0', '#/1', '#']);
  });

  it('подформа в подформе — путь группы от модели своей области', () => {
    interface Office {
      address: { city: string };
    }
    const model = createModel<{ office: Office }>({ office: { address: { city: '' } } });

    const office = compileSchema(
      {
        model: model.$.office,
        part: (sub: FormModel<Office>) => ({
          model: sub.$.address,
          part: (inner: FormModel<{ city: string }>) => ({ model: inner.$.city }),
        }),
      },
      model
    ).root as CompiledPartNode;
    const nested = office.content.root as CompiledPartNode;

    expect([office.content.scope, nested.content.scope]).toEqual(['#/office', '#/office/address']);
  });

  it('подформа в строке на группе вне строки — путь группы от корня модели', () => {
    const model = createShape();
    const phones = compileSchema(
      { model: model.$.phones, item: () => ({ model: model.$.home, part: address }) },
      model
    ).root as CompiledArrayNode;

    const row = phones.row(model.phones.at(0)!);

    expect((row.root as CompiledPartNode).content.scope).toBe(`${row.scope}/home`);
  });

  it('подформа на корне модели — область `#/`, модель области — сама модель', () => {
    // Так задумано (решение по arpz): подформа на самой модели и есть корень — контроллер отдаёт
    // ей корневую область, и правило к её узлу из поведения корня работает. Путь корня пуст,
    // поэтому идентификатор области — `#/`; уникальность селекторов компилятор проверяет в двух
    // областях раздельно.
    const model = createShape();

    const part = compileSchema(
      {
        model: model.$,
        part: (root: FormModel<Shape>) => ({ model: root.$.title }),
      } as unknown as FormSchemaNode,
      model
    ).root as CompiledPartNode;

    expect(part.content.scope).toBe('#/');
    expect(part.model).toBe(model);
  });

  it('без модели области путь подформы — абсолютный путь группы', () => {
    // JSDoc `compileSchema` раньше обещал здесь пути «по позиции узла»; исправлен по этому тесту.
    const model = createShape();

    const part = compileSchema({ model: model.phones.at(1)!.$.address, part: address })
      .root as CompiledPartNode;

    expect(part.content.scope).toBe('#/phones.1.address');
  });
});

describe('compileSchema — повтор selector в подформе и строке', () => {
  it('повтор в подформе — исключение при компиляции, в сообщении область подформы', () => {
    const model = createShape();
    const twice = (sub: FormModel<Address>): FormSchemaNode => ({
      children: [
        { selector: 'city', model: sub.$.city, component: InputStub },
        { selector: 'city', component: SectionStub },
      ],
    });

    expect(() =>
      compileSchema({ children: [{ model: model.$.home, part: twice }] }, model)
    ).toThrow('в области «#/home» селектор «city» повторяется — узлы #/0 и #/1');
  });

  it('повтор в строке — исключение при первом обращении к строке, а не при компиляции', () => {
    const model = createShape();
    const twice = (row: FormModel<Phone>): FormSchemaNode => ({
      children: [
        { selector: 'number', model: row.$.number, component: InputStub },
        { children: [{ selector: 'number', component: SectionStub }] },
      ],
    });
    const phones = compileSchema({ model: model.$.phones, item: twice }, model)
      .root as CompiledArrayNode;
    const rowModel = model.phones.at(0)!;

    expect(() => phones.row(rowModel)).toThrow(
      `в области «#/phones[${rowKeyOf(rowModel)}]» селектор «number» повторяется — узлы #/0 и #/1/0`
    );
  });

  it('пустой и нестроковый selector — не селектор: позиционный id, повтором не считается', () => {
    const model = createShape();

    const compiled = compileSchema(
      {
        children: [{ selector: '' }, { selector: '' }, { selector: 7 }, { selector: 7 }],
      } as unknown as FormSchemaNode,
      model
    );

    expect([...compiled.nodes.keys()]).toEqual(['#/0', '#/1', '#/2', '#/3', '#']);
    expect(nodeOf(compiled.nodes, '#/0')?.selector).toBeUndefined();
  });
});

describe('compileSchema — ключи, которые сборка не читает', () => {
  it('ключи корня и подформы — одно предупреждение на компиляцию, повтор ключа назван раз', () => {
    const warn = muteWarnings();
    const model = createShape();
    const legacy = (sub: FormModel<Address>) => ({
      children: [{ value: sub.$.city }, { label: 'Город' }],
    });

    compileSchema(
      {
        children: [{ value: model.$.title }, { model: model.$.home, part: legacy }],
      } as unknown as FormSchemaNode,
      model
    );

    const messages = warningsOf(warn);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('не читает: `value`, `label`.');
    // Подсказка замены — только для ключей, которые раньше что-то значили.
    expect(messages[0]).toContain('`value`: привязка поля');
    expect(messages[0]).not.toContain('`label`:');
  });

  it('ключи строки — одно предупреждение на шаблон, а не на каждую строку [ReFormer-arpz]', () => {
    const warn = muteWarnings();
    const model = createShape();
    const phones = compileSchema(
      {
        model: model.$.phones,
        item: (row: FormModel<Phone>) => ({ model: row.$.number, hint: 'номер' }),
      } as unknown as FormSchemaNode,
      model
    ).root as CompiledArrayNode;
    expect(warn).not.toHaveBeenCalled();

    phones.row(model.phones.at(0)!);
    phones.row(model.phones.at(1)!);
    phones.row(model.phones.at(1)!);

    expect(warningsOf(warn)).toEqual([expect.stringContaining('не читает: `hint`.')]);
  });
});

describe('compileSchema — прод-режим', () => {
  it('в production компилятор молчит, а вид узлов тот же', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = muteWarnings();
    const model = createShape();

    const root = compileSchema(
      {
        children: [
          { value: model.$.title },
          { model: model.$.title, part: address },
          { model: model.home, component: InputStub },
          model.$.home,
        ],
      } as unknown as FormSchemaNode,
      model
    ).root as CompiledContainerNode;

    expect(root.children.map((child) => child.kind)).toEqual([
      'container',
      'container',
      'container',
    ]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('compileSchema — корень области не узел', () => {
  it('корень сборки', () => {
    expect(() => compileSchema(null as never)).toThrow('корень области «#» — не узел схемы: null.');
  });

  it('корень подформы и строки — с идентификатором своей области', () => {
    const model = createShape();
    const phones = compileSchema(
      { model: model.$.phones, item: () => undefined } as unknown as FormSchemaNode,
      model
    ).root as CompiledArrayNode;
    const rowModel = model.phones.at(0)!;

    expect(() =>
      compileSchema(
        { model: model.$.home, part: () => 'адрес' } as unknown as FormSchemaNode,
        model
      )
    ).toThrow('корень области «#/home» — не узел схемы: адрес.');
    expect(() => phones.row(rowModel)).toThrow(
      `корень области «#/phones[${rowKeyOf(rowModel)}]» — не узел схемы: undefined.`
    );
  });
});

describe('compileSchema — зонды', () => {
  it('одна ручка в двух полях: оба узла в области, в индексе `fields` — последний', () => {
    // Так задумано (решение по arpz): индекс `fields` держит одно поле на ручку, и действует
    // последняя привязка — конфиг первой для ноды формы теряется, с dev-предупреждением
    // [ReFormer-dd58] (тест ниже).
    muteWarnings();
    const model = createShape();

    const compiled = compileSchema(
      {
        children: [
          { model: model.$.title, component: InputStub },
          { selector: 'summary', model: model.$.title, component: SectionStub, disabled: true },
        ],
      },
      model
    );

    const [first, second] = (compiled.root as CompiledContainerNode)
      .children as CompiledFieldNode[];
    expect([first.kind, second.kind]).toEqual(['field', 'field']);
    expect(compiled.fields.size).toBe(1);
    expect(compiled.fields.get(model.$.title)).toBe(second);
  });

  it('одна ручка в двух полях — dev-предупреждение о лишней привязке [ReFormer-dd58]', () => {
    const warn = muteWarnings();
    const model = createShape();
    const tree: FormSchemaNode = {
      children: [
        { model: model.$.title, component: InputStub },
        { model: model.$.title, component: SectionStub, disabled: true },
      ],
    };

    // Исключение при компиляции — тоже честный исход: автор узнаёт о повторе, как о повторе selector.
    try {
      compileSchema(tree, model);
    } catch {
      return;
    }

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('узел без `component` и без `children` — пустой контейнер с dev-предупреждением [ReFormer-arpz]', () => {
    // Такой узел ничего не рисует, и `componentProps` ему некому отдать: о нём предупреждают.
    const warn = muteWarnings();
    const model = createShape();

    const root = compileSchema(
      { children: [{}, { selector: 'placeholder', componentProps: { title: 'Пусто' } }] },
      model
    ).root as CompiledContainerNode;

    expect(root.children).toEqual([
      expect.objectContaining({ kind: 'container', id: '#/0', component: undefined, children: [] }),
      expect.objectContaining({
        kind: 'container',
        id: 'placeholder',
        props: { title: 'Пусто' },
        children: [],
      }),
    ]);
    expect(warningsOf(warn)).toEqual([
      expect.stringContaining('узел #/0 — без `component` и без `children`'),
      expect.stringContaining('узел placeholder — без `component` и без `children`'),
    ]);
  });

  it('часть на своей же группе — исключение «дерево зациклено» [ReFormer-hczl]', () => {
    const model = createShape();
    // Опечатка `sub.$` вместо ручки вложенной группы: часть подключает саму себя.
    const looped = (sub: FormModel<Address>): FormSchemaNode => ({
      children: [
        { model: sub.$.city, component: InputStub },
        { model: sub.$, part: looped } as unknown as FormSchemaNode,
      ],
    });

    expect(() => compileSchema({ model: model.$.home, part: looped }, model)).toThrow(
      'дерево схемы зациклено'
    );
  });

  it('часть, вернувшая узел-предка, — исключение «дерево зациклено» [ReFormer-hczl]', () => {
    const model = createShape();
    const section: { children: unknown[] } = { children: [] };
    const tree = { children: [section] };
    section.children.push({ model: model.$.home, part: () => tree });

    expect(() => compileSchema(tree as FormSchemaNode, model)).toThrow('дерево схемы зациклено');
  });

  it('selector `#/1` не вытесняет соседа с тем же путём из индекса [ReFormer-mn6p]', () => {
    const model = createShape();
    const tree: FormSchemaNode = {
      children: [{ selector: '#/1', component: SectionStub }, { component: SectionStub }],
    };

    // Исключение при компиляции — тоже честный исход: такой selector можно просто запретить.
    let compiled: CompiledSchema;
    try {
      compiled = compileSchema(tree, model);
    } catch {
      return;
    }

    const named = (compiled.root as CompiledContainerNode).children[0] as CompiledNode;
    expect(nodeOf(compiled.nodes, named.id)).toBe(named);
  });
});
