/**
 * Ключ строки массива под-форм (`rowKeyOf`) — по идентичности под-модели строки.
 *
 * Один источник для области строки в скомпилированной схеме (`#/phones[<ключ>]`) и для
 * `FormArray.keyAt(index)`: ключ держится за элемент модели и не меняется при `move`/`swap`.
 * Счётчик ключей — модульный и общий для всех массивов, поэтому тесты сверяют ключи между собой
 * (равенство, порядок, шаг), а не с абсолютными числами.
 */

import { describe, expect, it } from 'vitest';
import { rowKeyOf } from '../../../src/form/schema/row-key';
import { arrayOf, createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { createForm } from '../../../src/form/form-bundle';

interface Phone {
  number: string;
}

const createPhones = (numbers: string[]) =>
  createForm<{ phones: Phone[] }>({
    initial: {
      phones: arrayOf(
        () => ({ number: '' }),
        numbers.map((number) => ({ number }))
      ),
    },
    schema: (model) => ({
      children: [
        {
          model: model.$.phones,
          item: (row: FormModel<Phone>) => ({ children: [{ model: row.$.number }] }),
        },
      ],
    }),
  });

describe('row-key — монотонность и стабильность', () => {
  it('первый запрос выдаёт ключ, повторный — тот же', () => {
    const row = {};

    const key = rowKeyOf(row);

    expect(rowKeyOf(row)).toBe(key);
    expect(Number.isInteger(key)).toBe(true);
    expect(key).toBeGreaterThanOrEqual(0);
  });

  it('новые объекты получают ключи по возрастанию с шагом 1, повторы счётчик не двигают', () => {
    const [a, b, c] = [{}, {}, {}];

    const keyA = rowKeyOf(a);
    const keyB = rowKeyOf(b);
    rowKeyOf(a);
    rowKeyOf(b);
    const keyC = rowKeyOf(c);

    expect(keyB).toBe(keyA + 1);
    expect(keyC).toBe(keyB + 1);
  });

  it('равные по содержимому объекты — разные строки', () => {
    expect(rowKeyOf({ number: '1' })).not.toBe(rowKeyOf({ number: '1' }));
  });
});

describe('row-key — ключ держится за под-модель строки', () => {
  it('move и swap ключи строк не меняют', () => {
    const model = createModel({ phones: arrayOf(() => ({ number: '' }), [{ number: '1' }]) });
    model.phones.push({ number: '2' });
    model.phones.push({ number: '3' });
    const keys = [0, 1, 2].map((index) => rowKeyOf(model.phones.at(index)!));

    model.phones.move(0, 2);
    model.phones.swap(0, 1);

    expect([0, 1, 2].map((index) => rowKeyOf(model.phones.at(index)!))).toEqual([
      keys[2],
      keys[1],
      keys[0],
    ]);
  });

  it('удалённую строку с тем же значением не узнаёт: у вернувшейся строки новый ключ', () => {
    const model = createModel({ phones: arrayOf(() => ({ number: '' }), [{ number: '1' }]) });
    const before = rowKeyOf(model.phones.at(0)!);

    model.phones.removeAt(0);
    model.phones.push({ number: '1' });

    expect(rowKeyOf(model.phones.at(0)!)).toBeGreaterThan(before);
  });

  it('ключ области строки скомпилированной схемы и keyAt формы — один и тот же', () => {
    const bundle = createPhones(['1', '2']);
    const rows = bundle.render.tree!.arrays.get(bundle.model.$.phones)!;

    bundle.form.phones.move(0, 1);

    for (const index of [0, 1]) {
      const scope = rows.row(bundle.model.phones.at(index)!).scope;
      expect(scope).toBe(`#/phones[${bundle.form.phones.keyAt(index)}]`);
    }
  });
});
