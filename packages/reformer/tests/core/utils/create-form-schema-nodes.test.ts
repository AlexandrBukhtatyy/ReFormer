/**
 * Узлы схемы с привязкой к модели: поле, массив под-форм, подформа.
 *
 * Привязка — ключ `model` с ручкой из дерева `model.$`. Чем узел является, решают ручка и соседние
 * ключи (`item`, `part`), причём по ЗНАЧЕНИЮ: в записи «имя поля → узел» поле данных может
 * называться `model`, `item`, `part` или `value`.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFormFromModel } from '../../../src/form/create-form';
import { schemaSubtree } from '../../../src/form/schema-subtree';
import { createModel, type FormModel } from '../../../src/model/index';

const InputStub = () => null;
const SelectStub = () => null;

interface Address {
  city: string;
  street: string;
}
interface Row {
  name: string;
  address: Address;
}
interface Shape {
  title: string;
  tags: string[];
  registration: Address;
  residence: Address;
  rows: Row[];
}

const blankAddress = (): Address => ({ city: '', street: '' });
const createShape = () =>
  createModel<Shape>({
    title: '',
    tags: [],
    registration: blankAddress(),
    residence: blankAddress(),
    rows: [],
  });

const address = (model: FormModel<Address>) => ({
  children: [
    { model: model.$.city, component: InputStub, componentProps: { label: 'Город' } },
    { model: model.$.street, component: InputStub, componentProps: { label: 'Улица' } },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Ключ `model` — поле', () => {
  it('лист и массив-значение получают компонент и пропсы', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          { model: model.$.title, component: InputStub, componentProps: { label: 'Название' } },
          { model: model.$.tags, component: SelectStub },
        ],
      },
    });

    expect(form.title.component).toBe(InputStub);
    expect(form.title.componentProps.value).toEqual({ label: 'Название' });
    expect((form as unknown as { tags: { component: unknown } }).tags.component).toBe(SelectStub);
  });

  it('прежний ключ `value` по-прежнему принимается', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ value: model.$.title, component: InputStub }] },
    });

    expect(form.title.component).toBe(InputStub);
  });

  it('группа без `part` полем не становится — предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();

    createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.$.registration, component: InputStub }] },
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('не распознан как поле'));
  });
});

describe('Узел-подформа `{ model, part }`', () => {
  it('поля части получают конфиг; одна часть стоит в схеме дважды', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          { model: model.$.registration, part: address },
          { model: model.$.residence, part: address },
        ],
      },
    });

    expect(form.registration.city.component).toBe(InputStub);
    expect(form.registration.city.componentProps.value).toEqual({ label: 'Город' });
    expect(form.residence.street.componentProps.value).toEqual({ label: 'Улица' });
  });

  it('привязка под-моделью (`model.registration`) принимается наравне с ручкой', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.registration, part: address }] },
    });

    expect(form.registration.city.component).toBe(InputStub);
  });

  it('часть внутри строки массива', () => {
    const model = createShape();
    const row = (model: FormModel<Row>) => ({
      children: [
        { model: model.$.name, component: InputStub },
        { model: model.$.address, part: address },
      ],
    });
    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.$.rows, item: row }] },
    });

    model.rows.push({ name: 'a', address: blankAddress() });

    const rows = form.rows as unknown as { at(index: number): { address: { city: unknown } } };
    expect((rows.at(0).address.city as { component: unknown }).component).toBe(InputStub);
  });

  it('массив под-форм внутри части материализуется', () => {
    interface WithList {
      block: { list: { name: string }[] };
    }
    const model = createModel<WithList>({ block: { list: [] } });
    const item = (model: FormModel<{ name: string }>) => ({ children: [{ model: model.$.name }] });
    const block = (model: FormModel<WithList['block']>) => ({
      children: [{ model: model.$.list, item }],
    });
    const form = createFormFromModel<WithList>({
      model,
      schema: { children: [{ model: model.$.block, part: block }] },
    });

    model.block.list.push({ name: 'a' });

    const list = form.block.list as unknown as { length: { value: number } };
    expect(list.length.value).toBe(1);
  });
});

describe('Узел-массив `{ model, item }`', () => {
  it('ручка `model.$.rows` материализует массив под-форм', () => {
    const model = createShape();
    const row = (model: FormModel<Row>) => ({
      children: [{ model: model.$.name, component: InputStub }],
    });
    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.$.rows, item: row }] },
    });

    model.rows.push({ name: 'a', address: blankAddress() });

    const rows = form.rows as unknown as { at(index: number): { name: { component: unknown } } };
    expect(rows.at(0).name.component).toBe(InputStub);
  });

  it('билдер строки вызывается один раз на строку; рендерер получит то же поддерево', () => {
    const model = createShape();
    const row = vi.fn((model: FormModel<Row>) => ({ children: [{ model: model.$.name }] }));
    createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.$.rows, item: row }] },
    });

    model.rows.push({ name: 'a', address: blankAddress() });
    model.rows.push({ name: 'b', address: blankAddress() });
    const first = schemaSubtree(row, model.rows.at(0));

    expect(row).toHaveBeenCalledTimes(2);
    expect(schemaSubtree(row, model.rows.at(0))).toBe(first);
    expect(schemaSubtree(row, model.rows.at(1))).not.toBe(first);
  });
});

describe('Запись «имя поля → узел»: поля данных с именами ключей узла', () => {
  it('поля `model`, `item`, `part`, `value` — обычные вложенные узлы', () => {
    interface Reserved {
      model: string;
      item: string;
      part: string;
      value: string;
    }
    const model = createModel<Reserved>({ model: '', item: '', part: '', value: '' });

    const form = createFormFromModel<Reserved>({
      model,
      schema: {
        model: { model: model.$.model, component: InputStub },
        item: { model: model.$.item, component: InputStub },
        part: { model: model.$.part, component: InputStub },
        value: { model: model.$.value, component: InputStub },
      },
    });

    // `form.value` занято самой формой (значение группы) — поля берём по пути.
    const fieldAt = (key: string) =>
      (form as unknown as { getFieldByPath(path: string): { component: unknown } }).getFieldByPath(
        key
      );
    for (const key of ['model', 'item', 'part', 'value']) {
      expect(fieldAt(key).component, key).toBe(InputStub);
    }
  });
});
