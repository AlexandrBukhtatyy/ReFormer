// @vitest-environment happy-dom
/**
 * `useFieldArray` подписан на состав строк, а не на значение массива.
 *
 * Значение массива производно от значений строк и меняется на каждую клавишу в любой строке, а
 * список от этого не меняется. Было: хук подписывался на `value`, и правка поля строки
 * перерисовывала список и всё, что вокруг него, — на каждую клавишу. Состав меняют добавление,
 * удаление и перестановка; замечания массива — проверка. На них список перерисовывается.
 */
import { Profiler } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { arrayOf, createForm, type FormArray, type FormModel } from '@reformer/core';
import { useFieldArray } from './useFieldArray';

interface Phone {
  number: string;
}

const createPhones = () =>
  createForm<{ phones: Phone[] }>({
    initial: { phones: arrayOf(() => ({ number: '' }), [{ number: '111' }, { number: '222' }]) },
    schema: (model) => ({
      children: [
        {
          model: model.$.phones,
          item: (row: FormModel<Phone>) => ({ children: [{ model: row.$.number }] }),
        },
      ],
    }),
  });

function List({ control }: { control: FormArray<Phone> }) {
  const { items } = useFieldArray(control);
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} data-id={item.id} />
      ))}
    </ul>
  );
}

/** Список строк: число его рендеров (Profiler) и ключи строк по порядку (DOM). */
function renderList(control: FormArray<Phone>) {
  const renders = { count: 0 };
  const { container } = render(
    <Profiler id="list" onRender={() => renders.count++}>
      <List control={control} />
    </Profiler>
  );
  const ids = () => [...container.querySelectorAll('li')].map((li) => li.dataset.id);
  return { renders, ids };
}

afterEach(cleanup);

describe('useFieldArray — подписка на состав строк', () => {
  it('правка поля строки не перерисовывает список', () => {
    const bundle = createPhones();
    const { renders } = renderList(bundle.form.phones);
    const before = renders.count;

    act(() => {
      bundle.form.phones.at(0)!.number.setValue('1112');
      bundle.form.phones.at(1)!.number.setValue('2223');
    });

    expect(renders.count).toBe(before);
  });

  it('добавление, перестановка и удаление перерисовывают список', () => {
    const bundle = createPhones();
    const phones = bundle.form.phones;
    const { ids } = renderList(phones);
    const [first, second] = ids();

    act(() => phones.push({ number: '333' }));
    expect(ids()).toHaveLength(3);
    const third = ids()[2];

    act(() => phones.move(2, 0));
    expect(ids()).toEqual([third, first, second]);

    act(() => phones.removeAt(1));
    expect(ids()).toEqual([third, second]);
  });

  it('замечания массива перерисовывают список', () => {
    const bundle = createPhones();
    const phones = bundle.form.phones;
    const { renders } = renderList(phones);
    const before = renders.count;

    act(() => phones.setIssues([{ code: 'minItems' }]));

    expect(renders.count).toBe(before + 1);
  });
});
