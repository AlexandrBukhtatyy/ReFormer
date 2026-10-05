/**
 * Обход схемы при сборке формы: что он пропускает и на чём не падает.
 *
 * Обход глубокий и идёт по любым ключам, поэтому в `componentProps` ему встречается чужое:
 * React-элементы, цикличные объекты, сама модель. Спускаться в них нельзя — это либо бесконечная
 * рекурсия, либо реактивное чтение значений модели.
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

describe('Обход схемы: чужие объекты в componentProps', () => {
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
          { value: model.$.title, component: InputStub, componentProps: { icon: element } },
        ],
      },
    });

    expect(form.title.componentProps.value.icon).toBe(element);
  });

  it('цикличный объект обходится один раз', () => {
    const model = createShape();
    const cyclic: Record<string, unknown> = { label: 'x' };
    cyclic.self = cyclic;

    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [{ value: model.$.title, component: InputStub, componentProps: { cyclic } }],
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
          { value: model.$.title, component: InputStub, componentProps: shared },
          { value: model.$.profile.email, component: InputStub, componentProps: shared },
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
            value: model.$.title,
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
  const rowItem = (row: FormModel<Row>) => ({ children: [{ value: row.$.name }] });

  it('привязка фасадом и привязка ручкой дают одну и ту же ноду массива', () => {
    const byFacade = createShape();
    const formByFacade = createFormFromModel<Shape>({
      model: byFacade,
      schema: { children: [{ array: byFacade.rows, item: rowItem }] },
    });
    const byHandle = createShape();
    const formByHandle = createFormFromModel<Shape>({
      model: byHandle,
      schema: { children: [{ array: byHandle.$.rows, item: rowItem }] },
    });

    byFacade.rows.push({ name: 'a' });
    byHandle.rows.push({ name: 'a' });

    const lengthOf = (form: unknown) =>
      (form as { rows: { length: { value: number } } }).rows.length.value;
    expect(lengthOf(formByFacade)).toBe(1);
    expect(lengthOf(formByHandle)).toBe(1);
  });

  it('`array` — не массив модели: узел пропускается с предупреждением', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createShape();

    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ array: { __path: 'rows' }, item: rowItem }] },
    });

    expect((form as unknown as Record<string, unknown>).rows).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('у узла-массива `array` — не массив модели')
    );
  });
});
