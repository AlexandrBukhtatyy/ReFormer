/**
 * Обход схемы при сборке формы: что он читает, что пропускает и о чём предупреждает.
 *
 * Вложенные узлы обход берёт только из `children` и из поддерева `part`. В `componentProps` он
 * не заглядывает: там лежит чужое — React-элементы, цикличные объекты, сама модель.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFormFromModel } from '../../../src/form/create-form';
import { createModel, type FormModel } from '../../../src/model/index';

const InputStub = () => null;

interface Row {
  name: string;
}
interface Shape {
  title: string;
  profile: { email: string };
  rows: Row[];
}

const createShape = () => createModel<Shape>({ title: '', profile: { email: '' }, rows: [] });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Обход схемы: componentProps доходят до ноды нетронутыми', () => {
  it('React-элемент с циклом через _owner не обходится', () => {
    const model = createShape();
    // Элемент, созданный во время рендера, в dev ссылается на Fiber, а дерево Fiber циклично.
    const fiber: Record<string, unknown> = {};
    fiber.return = fiber;
    const element = {
      $$typeof: Symbol.for('react.element'),
      type: 'span',
      props: {},
      _owner: fiber,
    };

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          { model: model.$.title, component: InputStub, componentProps: { icon: element } },
        ],
      },
    });

    expect(form.title.componentProps.value.icon).toBe(element);
  });

  it('цикличный объект в пропсах сборке не мешает', () => {
    const model = createShape();
    const cyclic: Record<string, unknown> = { label: 'x' };
    cyclic.self = cyclic;

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [{ model: model.$.title, component: InputStub, componentProps: { cyclic } }],
      },
    });

    expect(form.title.componentProps.value.cyclic).toBe(cyclic);
  });

  it('один и тот же объект в двух местах дерева не мешает сборке', () => {
    const model = createShape();
    const shared = { hint: 'общая подсказка' };

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          { model: model.$.title, component: InputStub, componentProps: shared },
          { model: model.$.profile.email, component: InputStub, componentProps: shared },
        ],
      },
    });

    expect(form.title.componentProps.value).toEqual(shared);
    expect(form.profile.email.componentProps.value).toEqual(shared);
  });

  it('модель, под-модель и ручка группы в componentProps доходят до компонента нетронутыми', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          {
            model: model.$.title,
            component: InputStub,
            componentProps: { model, profile: model.profile, profileSignals: model.$.profile },
          },
        ],
      },
    });

    const props = form.title.componentProps.value;
    expect(props.model).toBe(model);
    expect(props.profile).toBe(model.profile);
    expect(props.profileSignals).toBe(model.$.profile);
  });
});

describe('Узел-массив схемы', () => {
  const rowItem = (row: FormModel<Row>) => ({ children: [{ model: row.$.name }] });

  it('привязка фасадом и привязка ручкой дают одну и ту же ноду массива', () => {
    const byFacade = createShape();
    const formByFacade = createFormFromModel<Shape>({
      model: byFacade,
      schema: { children: [{ model: byFacade.rows as never, item: rowItem }] },
    });
    const byHandle = createShape();
    const formByHandle = createFormFromModel<Shape>({
      model: byHandle,
      schema: { children: [{ model: byHandle.$.rows, item: rowItem }] },
    });

    byFacade.rows.push({ name: 'a' });
    byHandle.rows.push({ name: 'a' });

    const lengthOf = (form: unknown) =>
      (form as { rows: { length: { value: number } } }).rows.length.value;
    expect(lengthOf(formByFacade)).toBe(1);
    expect(lengthOf(formByHandle)).toBe(1);
  });

  it('привязка — не массив модели: узел с `item` пропускается с предупреждением', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();

    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.$.title as never, item: rowItem }] },
    });

    expect((form as unknown as Record<string, unknown>).rows).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('у узла с `item` привязка — не массив модели')
    );
  });
});

describe('Обход схемы: вложенные узлы только в children и part', () => {
  it('узел в componentProps полем не становится', () => {
    const model = createShape();

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        component: InputStub,
        componentProps: { header: { model: model.$.title, component: InputStub } },
      },
    });

    // Нода есть — её строит вид узла модели; конфига из схемы у неё нет.
    expect(form.title.component).toBeUndefined();
  });

  it('массив под-форм в componentProps не подключается', () => {
    const model = createShape();
    const rowItem = (row: FormModel<Row>) => ({ children: [{ model: row.$.name }] });

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        component: InputStub,
        componentProps: { rows: { model: model.$.rows, item: rowItem } },
      },
    });

    expect((form as unknown as Record<string, unknown>).rows).toBeUndefined();
  });

  it('узлы под произвольными ключами не читаются — предупреждение называет ключи', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        title: { model: model.$.title, component: InputStub },
        steps: [{ model: model.$.profile.email, component: InputStub }],
      } as never,
    });

    expect(form.title.component).toBeUndefined();
    expect(form.profile.email.component).toBeUndefined();
    const [message] = warn.mock.calls.find(([text]) => String(text).includes('не читает')) ?? [];
    expect(message).toContain('`title`, `steps`');
    expect(message).toContain('вложенные узлы читаются только из `children`');
  });

  it('прежние ключи привязки `value` и `array` — предупреждение с заменой', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();
    const rowItem = (row: FormModel<Row>) => ({ children: [{ model: row.$.name }] });

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          { value: model.$.title, component: InputStub },
          { array: model.rows, item: rowItem },
        ],
      } as never,
    });

    expect(form.title.component).toBeUndefined();
    expect((form as unknown as Record<string, unknown>).rows).toBeUndefined();
    const [message] = warn.mock.calls.find(([text]) => String(text).includes('не читает')) ?? [];
    expect(message).toContain('`value`: привязка поля — `model: model.$.<поле>`');
    expect(message).toContain('`array`: привязка массива под-форм — `model: model.$.<массив>`');
  });

  it('узел без лишних ключей предупреждений не даёт', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();
    const rowItem = (row: FormModel<Row>) => ({ children: [{ model: row.$.name }] });

    createFormFromModel<Shape>({
      model,
      schema: {
        selector: 'root',
        component: InputStub,
        componentProps: { title: 'Форма' },
        children: [
          'Текст',
          model.$.title,
          { model: model.$.title, component: InputStub, disabled: true },
          { model: model.$.rows, item: rowItem, initialValue: { name: '' } },
        ],
      },
    });

    expect(warn).not.toHaveBeenCalled();
  });
});
