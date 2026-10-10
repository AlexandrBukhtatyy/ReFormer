/**
 * FieldArray.Root с render-prop: состояние массива приходит функции-ребёнку, тип строки выводится
 * из `control` — `items[i].control` типизирован без явного дженерика.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { arrayOf, createForm, type FormModel } from '@reformer/core';
import { FieldArray } from './FieldArray';

interface Phone {
  number: string;
}

const createPhones = () =>
  createForm<{ phones: Phone[] }>({
    initial: { phones: arrayOf(() => ({ number: '' }), [{ number: '111' }, { number: '222' }]) },
    // Массив строк — узел { model, item }: без него массив модели остаётся полем-значением.
    schema: (model) => ({
      children: [
        {
          model: model.$.phones,
          item: (row: FormModel<Phone>) => ({ children: [{ model: row.$.number }] }),
        },
      ],
    }),
  });

describe('FieldArray.Root — render-prop', () => {
  it('отдаёт состояние массива с типизированными строками', () => {
    const bundle = createPhones();

    const html = renderToStaticMarkup(
      <FieldArray.Root control={bundle.form.phones}>
        {({ items, length }) => (
          <ul data-length={length}>
            {items.map(({ control, id }) => (
              // `control.number` — FormControl<string>: тип строки выведен из control у Root.
              <li key={id}>{control.number.value.value}</li>
            ))}
          </ul>
        )}
      </FieldArray.Root>
    );

    expect(html).toBe('<ul data-length="2"><li>111</li><li>222</li></ul>');
  });

  it('обычные дети по-прежнему работают', () => {
    const bundle = createPhones();

    const html = renderToStaticMarkup(
      <FieldArray.Root control={bundle.form.phones}>
        <FieldArray.Count />
      </FieldArray.Root>
    );

    expect(html).toContain('2');
  });
});
