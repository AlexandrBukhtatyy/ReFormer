/**
 * Шаблон нового элемента массива — `arrayOf(blank)` в модели.
 *
 * Шаблон отвечает на вопрос «что кладёт `push()` без значения» и объявляется там же, где остальные
 * начальные значения. Он принадлежит узлу массива, а не значению: `set` / `patch` / `reset`
 * заменяют элементы, но не шаблон.
 */

import { describe, it, expect } from 'vitest';
import { arrayOf, createModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import type { FormModel } from '../../../src/model/types';

interface Phone {
  number: string;
}
interface CoBorrower {
  name: string;
  phones: Phone[];
}
interface Shape {
  coBorrowers: CoBorrower[];
  tags: string[];
}

const blankPhone = (): Phone => ({ number: '' });
const blankCoBorrower = (): CoBorrower => ({ name: '', phones: arrayOf(blankPhone) });

const createShape = () => createModel<Shape>({ coBorrowers: arrayOf(blankCoBorrower), tags: [] });

describe('arrayOf — значение', () => {
  it('возвращает обычный массив: шаблон не виден в ключах и в JSON', () => {
    const items = arrayOf(blankPhone, [{ number: '1' }]);

    expect(Array.isArray(items)).toBe(true);
    expect(items).toEqual([{ number: '1' }]);
    expect(Object.keys(items)).toEqual(['0']);
    expect(JSON.stringify(items)).toBe('[{"number":"1"}]');
  });

  it('начальные элементы попадают в модель', () => {
    const model = createModel({ phones: arrayOf(blankPhone, [{ number: '1' }, { number: '2' }]) });

    expect(model.get()).toEqual({ phones: [{ number: '1' }, { number: '2' }] });
  });
});

describe('arrayOf — добавление элемента', () => {
  it('push() без значения кладёт элемент по шаблону', () => {
    const model = createShape();

    model.coBorrowers.push();

    expect(model.get().coBorrowers).toEqual([{ name: '', phones: [] }]);
  });

  it('каждое добавление вызывает шаблон заново — значение не делится между элементами', () => {
    const model = createShape();

    model.coBorrowers.push();
    model.coBorrowers.push();
    model.coBorrowers.at(0).name = 'Анна';

    expect(model.coBorrowers.at(1).name).toBe('');
  });

  it('push(значение) работает как раньше', () => {
    const model = createShape();

    model.coBorrowers.push({ name: 'Анна', phones: [{ number: '1' }] });

    expect(model.get().coBorrowers).toEqual([{ name: 'Анна', phones: [{ number: '1' }] }]);
  });

  it('insertAt(i) без значения вставляет элемент по шаблону', () => {
    const model = createShape();
    model.coBorrowers.push({ name: 'Анна', phones: [] });

    model.coBorrowers.insertAt(0);

    expect(model.get().coBorrowers.map((item) => item.name)).toEqual(['', 'Анна']);
  });

  it('массив без шаблона: push() без значения бросает ошибку с подсказкой', () => {
    const model = createShape();

    expect(() => model.tags.push()).toThrow(/tags: добавление элемента без значения.*arrayOf/s);
    expect(model.tags.length).toBe(0);
  });
});

describe('arrayOf — шаблон переживает замену значений', () => {
  it('set и patch заменяют элементы, шаблон остаётся', () => {
    const model = createShape();

    model.patch({ coBorrowers: [{ name: 'Анна', phones: [] }] });
    model.coBorrowers.push();
    expect(model.coBorrowers.length).toBe(2);

    model.set({ coBorrowers: [], tags: [] });
    model.coBorrowers.push();
    expect(model.get().coBorrowers).toEqual([{ name: '', phones: [] }]);
  });

  it('reset возвращает исходные элементы и сохраняет шаблон', () => {
    const model = createShape();
    model.coBorrowers.push();
    model.coBorrowers.push();

    model.reset();
    expect(model.coBorrowers.length).toBe(0);

    model.coBorrowers.push();
    expect(model.coBorrowers.length).toBe(1);
  });

  it('замена массива целиком через ручку `$` шаблон не трогает', () => {
    const model = createShape();

    model.$.coBorrowers.value = [{ name: 'Анна', phones: [] }];
    model.coBorrowers.push();

    expect(model.get().coBorrowers.map((item) => item.name)).toEqual(['Анна', '']);
  });
});

describe('arrayOf — вложенные массивы', () => {
  it('элемент по шаблону несёт шаблон вложенного массива', () => {
    const model = createShape();
    model.coBorrowers.push();

    model.coBorrowers.at(0).phones.push();

    expect(model.get().coBorrowers[0].phones).toEqual([{ number: '' }]);
  });

  it('элемент из обычных данных берёт шаблон вложенного массива из шаблона родителя', () => {
    const model = createShape();
    // Так приходят данные с сервера: обычные массивы без `arrayOf`.
    model.patch({ coBorrowers: [{ name: 'Анна', phones: [{ number: '1' }] }] });

    model.coBorrowers.at(0).phones.push();

    expect(model.get().coBorrowers[0].phones).toEqual([{ number: '1' }, { number: '' }]);
  });

  it('push(значение) с обычным вложенным массивом — то же самое', () => {
    const model = createShape();
    model.coBorrowers.push({ name: 'Анна', phones: [] });

    model.coBorrowers.at(0).phones.push();

    expect(model.get().coBorrowers[0].phones).toEqual([{ number: '' }]);
  });

  it('после reset вложенные шаблоны на месте', () => {
    const model = createModel<Shape>({
      coBorrowers: arrayOf(blankCoBorrower, [{ name: 'Анна', phones: [] }]),
      tags: [],
    });
    model.coBorrowers.at(0).phones.push();

    model.reset();
    model.coBorrowers.at(0).phones.push();

    expect(model.get().coBorrowers[0].phones).toEqual([{ number: '' }]);
  });
});

describe('arrayOf — нода массива формы', () => {
  const phoneItem = (model: FormModel<Phone>) => ({ children: [{ model: model.$.number }] });
  const coBorrowerItem = (model: FormModel<CoBorrower>) => ({
    children: [{ model: model.$.name }, { model: model.$.phones, item: phoneItem }],
  });
  const pushOf = (node: unknown) => (node as { push: (value?: unknown) => void }).push;

  it('push() ноды без значения берёт шаблон модели', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.$.coBorrowers, item: coBorrowerItem }] },
    });

    pushOf(form.coBorrowers).call(form.coBorrowers);

    expect(model.get().coBorrowers).toEqual([{ name: '', phones: [] }]);
  });

  it('`initialValue` узла — запасной шаблон для модели без `arrayOf`', () => {
    const model = createModel<Shape>({ coBorrowers: [], tags: [] });
    const form = createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          {
            model: model.$.coBorrowers,
            item: coBorrowerItem,
            initialValue: { name: 'по умолчанию', phones: [] },
          },
        ],
      },
    });

    pushOf(form.coBorrowers).call(form.coBorrowers);
    model.coBorrowers.push();
    model.coBorrowers.at(0).name = 'Анна';

    // Значение-шаблон копируется на каждое добавление.
    expect(model.get().coBorrowers.map((item) => item.name)).toEqual(['Анна', 'по умолчанию']);
  });

  it('`initialValue`-фабрика вызывается на каждое добавление', () => {
    const model = createModel<Shape>({ coBorrowers: [], tags: [] });
    let calls = 0;
    createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          {
            model: model.$.coBorrowers,
            item: coBorrowerItem,
            initialValue: () => ({ name: `№${++calls}`, phones: [] }),
          },
        ],
      },
    });

    model.coBorrowers.push();
    model.coBorrowers.push();

    expect(model.get().coBorrowers.map((item) => item.name)).toEqual(['№1', '№2']);
  });

  it('шаблон модели главнее `initialValue` узла', () => {
    const model = createShape();
    createFormFromModel<Shape>({
      model,
      schema: {
        children: [
          {
            model: model.$.coBorrowers,
            item: coBorrowerItem,
            initialValue: { name: 'из схемы', phones: [] },
          },
        ],
      },
    });

    model.coBorrowers.push();

    expect(model.get().coBorrowers[0].name).toBe('');
  });
});
