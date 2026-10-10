/**
 * Поддерево схемы для под-модели (`schemaSubtree`) — кэш билдеров строк массива и подформ.
 *
 * Билдер `item` / `part` зовут сборка формы и рендерер, и оба обязаны получить ОДНО дерево: на
 * объектах его узлов держится идентичность — ключи рендера, записи схемы-контроллера. Здесь
 * закреплено, когда строится поддерево строки, что отдаёт повторное обращение, что становится с
 * кэшем при удалении и замене строк (память привязана к под-модели — строка ушла, ушли и её
 * поддеревья) и что перестановка строк поддеревья и области строк не трогает.
 */

import { describe, it, expect, vi } from 'vitest';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { tick } from '../../test-utils/async';
import { InputStub } from '../../test-utils/stubs';
import { schemaSubtree } from '../../../src/form/schema-subtree';
import { compileSchema } from '../../../src/form/schema/compile';
import { rowKeyOf } from '../../../src/form/schema/row-key';
import { createForm } from '../../../src/form/form-bundle';
import type {
  CompiledArrayNode,
  CompiledContainerNode,
  CompiledPartNode,
} from '../../../src/form/schema/compiled';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

interface Row {
  name: string;
}
interface Shape {
  rows: Row[];
}

type RowBuilder = (row: FormModel<Row>) => FormSchemaNode;

const rowItem: RowBuilder = (row) => ({
  selector: 'row',
  children: [{ model: row.$.name, component: InputStub }],
});

/** Сборка с массивом под-форм: формы строк строятся сразу, рендерер берёт `render.tree`. */
const createRows = (names: string[], item: RowBuilder) =>
  createForm<Shape>({
    initial: {
      rows: arrayOf(
        (): Row => ({ name: '' }),
        names.map((name) => ({ name }))
      ),
    },
    schema: (model) => ({ children: [{ model: model.$.rows, item }] }),
  });

/** Компиляция массива строк из сборки — та, что читает рендерер. */
const rowsOf = (bundle: ReturnType<typeof createRows>): CompiledArrayNode =>
  bundle.render.tree!.arrays.get(bundle.model.$.rows)!;

/** Под-модели строк по порядку. */
const rowModels = (bundle: ReturnType<typeof createRows>): FormModel<Row>[] =>
  Array.from({ length: bundle.model.rows.length }, (_, index) => bundle.model.rows.at(index)!);

/**
 * Ручной сборщик мусора: флаг `--expose-gc` включается на лету, функцию `gc` отдаёт контекст,
 * созданный уже после этого.
 */
const collectGarbage = (): void => {
  setFlagsFromString('--expose_gc');
  (runInNewContext('gc') as () => void)();
};

describe('schema-subtree — кэш пары «билдер + под-модель»', () => {
  it('билдер вызывается один раз на пару; повторное обращение отдаёт тот же объект', () => {
    const model = createModel({ home: { city: '' } });
    const builder = vi.fn((sub: FormModel<{ city: string }>) => ({ model: sub.$.city }));

    const first = schemaSubtree(builder, model.home);

    expect(schemaSubtree(builder, model.home)).toBe(first);
    expect(builder).toHaveBeenCalledTimes(1);
    expect(builder).toHaveBeenCalledWith(model.home);
  });

  it('разные билдеры на одной под-модели и один билдер на разных — разные поддеревья', () => {
    const model = createModel({ home: { city: '' }, work: { city: '' } });
    const short = (sub: FormModel<{ city: string }>) => ({ model: sub.$.city });
    const full = (sub: FormModel<{ city: string }>) => ({ children: [{ model: sub.$.city }] });

    const homeShort = schemaSubtree(short, model.home);

    expect(schemaSubtree(full, model.home)).not.toBe(homeShort);
    expect(schemaSubtree(short, model.work)).not.toBe(homeShort);
    expect(schemaSubtree(short, model.home)).toBe(homeShort);
  });

  it('пустой результат билдера тоже запоминается', () => {
    const model = createModel({ home: { city: '' } });
    const builder = vi.fn(() => undefined);

    schemaSubtree(builder, model.home);
    schemaSubtree(builder, model.home);

    expect(builder).toHaveBeenCalledTimes(1);
  });

  it('билдер, бросивший исключение, ничего не запоминает — следующий вызов строит заново', () => {
    const model = createModel({ home: { city: '' } });
    let ready = false;
    const builder = vi.fn((sub: FormModel<{ city: string }>) => {
      if (!ready) throw new Error('справочник не загружен');
      return { model: sub.$.city };
    });

    expect(() => schemaSubtree(builder, model.home)).toThrow('справочник не загружен');
    ready = true;
    const tree = schemaSubtree(builder, model.home);

    expect(schemaSubtree(builder, model.home)).toBe(tree);
    expect(builder).toHaveBeenCalledTimes(2);
  });
});

describe('schema-subtree — строки массива под-форм', () => {
  it('без формы поддерево строки строится при первом row(), и его же отдаёт schemaSubtree', () => {
    const model = createModel<Shape>({ rows: [{ name: 'a' }] });
    const item = vi.fn(rowItem);
    const rows = compileSchema({ model: model.$.rows, item }, model).root as CompiledArrayNode;
    const first = model.rows.at(0)!;
    expect(item).not.toHaveBeenCalled();

    const compiled = rows.row(first);

    expect(item).toHaveBeenCalledTimes(1);
    expect(compiled.root.source).toBe(schemaSubtree(item, first));
    expect(item).toHaveBeenCalledTimes(1);
  });

  it('сборка строит поддеревья строк сразу; рендерер получает те же — без новых вызовов', () => {
    const item = vi.fn(rowItem);
    const bundle = createRows(['a', 'b'], item);
    expect(item).toHaveBeenCalledTimes(2);

    for (const row of rowModels(bundle)) {
      const compiled = rowsOf(bundle).row(row);
      expect(compiled.root.source).toBe(schemaSubtree(item, row));
      expect(rowsOf(bundle).row(row)).toBe(compiled);
    }

    expect(item).toHaveBeenCalledTimes(2);
    // Конфиг ноды строки — из того же поддерева.
    expect(bundle.form.rows.at(1)?.name.component).toBe(InputStub);
  });

  it('новая строка — новое поддерево: push строит его вместе с формой строки', () => {
    const item = vi.fn(rowItem);
    const bundle = createRows(['a'], item);
    const before = schemaSubtree(item, bundle.model.rows.at(0)!);

    bundle.form.rows.push({ name: 'b' });

    expect(item).toHaveBeenCalledTimes(2);
    const added = bundle.model.rows.at(1)!;
    expect(item).toHaveBeenLastCalledWith(added);
    expect(schemaSubtree(item, added)).not.toBe(before);
  });

  it('удаление строки: оставшиеся поддеревья не перестраиваются, удалённая держит своё', () => {
    const item = vi.fn(rowItem);
    const bundle = createRows(['a', 'b', 'c'], item);
    const [removed, second, third] = rowModels(bundle);
    const subtrees = [removed, second, third].map((row) => schemaSubtree(item, row));
    const compiledSecond = rowsOf(bundle).row(second);

    bundle.form.rows.removeAt(0);

    expect(rowModels(bundle)).toEqual([second, third]);
    expect(rowModels(bundle).map((row) => schemaSubtree(item, row))).toEqual(subtrees.slice(1));
    expect(rowsOf(bundle).row(second)).toBe(compiledSecond);
    // Пока на под-модель удалённой строки есть ссылка, её поддерево в памяти; новой строке с тем
    // же значением оно не достаётся.
    expect(schemaSubtree(item, removed)).toBe(subtrees[0]);
    expect(item).toHaveBeenCalledTimes(3);

    bundle.form.rows.push({ name: 'a' });

    expect(item).toHaveBeenCalledTimes(4);
    expect(schemaSubtree(item, bundle.model.rows.at(2)!)).not.toBe(subtrees[0]);
  });

  it('удалённая строка уходит сборщику мусора вместе с поддеревом и схемой строки', async () => {
    // Всё, что держит строку, создаётся внутри функции: снаружи остаются только слабые ссылки.
    const removeFirst = () => {
      const item: RowBuilder = (row) => ({ children: [{ model: row.$.name }] });
      const bundle = createRows(['a', 'b'], item);
      const first = bundle.model.rows.at(0)!;
      const refs = [
        new WeakRef(first),
        new WeakRef(schemaSubtree(item, first) as object),
        new WeakRef(rowsOf(bundle).row(first)),
      ];
      bundle.form.rows.removeAt(0);
      return { bundle, refs };
    };
    const { bundle, refs } = removeFirst();

    for (let attempt = 0; attempt < 10 && refs.some((ref) => ref.deref()); attempt++) {
      await tick();
      collectGarbage();
    }

    expect(refs.map((ref) => ref.deref())).toEqual([undefined, undefined, undefined]);
    // Сборка жива: строку отпустила она сама, а не сборщик вместе со всей формой.
    expect(bundle.form.rows.length).toBe(1);
  });

  it('замена массива (patch) даёт новые под-модели — поддеревья и области строятся заново', () => {
    const item = vi.fn(rowItem);
    const bundle = createRows(['a', 'b'], item);
    const before = rowModels(bundle);
    const scopes = before.map((row) => rowsOf(bundle).row(row).scope);

    bundle.model.patch({ rows: [{ name: 'x' }, { name: 'y' }] });

    const after = rowModels(bundle);
    expect(after.some((row) => before.includes(row))).toBe(false);
    expect(item).toHaveBeenCalledTimes(4);
    expect(after.map((row) => schemaSubtree(item, row))).not.toContain(
      schemaSubtree(item, before[0])
    );
    expect(after.map((row) => rowsOf(bundle).row(row).scope)).not.toContain(scopes[0]);
  });

  it('move, swap и insert: поддерево, схема и область строки остаются за строкой', () => {
    const item = vi.fn(rowItem);
    const bundle = createRows(['a', 'b', 'c'], item);
    const rows = rowModels(bundle);
    const snapshot = () =>
      rows.map((row) => {
        const compiled = rowsOf(bundle).row(row);
        return { subtree: schemaSubtree(item, row), compiled, scope: compiled.scope };
      });
    const before = snapshot();

    bundle.form.rows.move(0, 2);
    bundle.form.rows.swap(0, 1);
    bundle.form.rows.insert(1, { name: 'новая' });

    expect(snapshot()).toEqual(before);
    for (const [index, entry] of snapshot().entries()) {
      expect(entry.compiled).toBe(before[index].compiled);
      expect(entry.subtree).toBe(before[index].subtree);
    }
    // Новая строка получила своё поддерево; остальные билдер не перестраивал.
    expect(item).toHaveBeenCalledTimes(4);
    // Ключ в области строки — тот же, что отдаёт форма по текущему индексу.
    rowModels(bundle).forEach((row, index) => {
      expect(rowsOf(bundle).row(row).scope).toBe(`#/rows[${bundle.form.rows.keyAt(index)}]`);
    });
  });

  it('вложенные области строки переживают перестановку внешних строк', () => {
    interface Office {
      city: string;
    }
    interface Phone {
      number: string;
    }
    interface Contact {
      office: Office;
      phones: Phone[];
    }
    const office = (sub: FormModel<Office>): FormSchemaNode => ({ model: sub.$.city });
    const phoneItem = vi.fn(
      (phone: FormModel<Phone>): FormSchemaNode => ({ model: phone.$.number })
    );
    const contactItem = (contact: FormModel<Contact>): FormSchemaNode => ({
      children: [
        { model: contact.$.office, part: office },
        { model: contact.$.phones, item: phoneItem },
      ],
    });
    const blankContact = (city: string): Contact => ({
      office: { city },
      phones: [{ number: city }],
    });
    const bundle = createForm<{ contacts: Contact[] }>({
      initial: {
        contacts: arrayOf(() => blankContact(''), [blankContact('a'), blankContact('b')]),
      },
      schema: (model) => ({ children: [{ model: model.$.contacts, item: contactItem }] }),
    });
    const contacts = bundle.render.tree!.arrays.get(bundle.model.$.contacts)!;
    const first = bundle.model.contacts.at(0)!;
    const phone = first.phones.at(0)!;
    const nested = () => {
      const row = contacts.row(first);
      const [part, phones] = (row.root as CompiledContainerNode).children as [
        CompiledPartNode,
        CompiledArrayNode,
      ];
      return { row: row.scope, part: part.content.scope, phone: phones.row(phone).scope };
    };
    const before = nested();

    bundle.form.contacts.move(0, 1);

    expect(nested()).toEqual(before);
    expect(before.phone).toBe(`${before.row}/phones[${rowKeyOf(phone)}]`);
    expect(phoneItem).toHaveBeenCalledTimes(2);
  });
});
