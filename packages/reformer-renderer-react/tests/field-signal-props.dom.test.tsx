// @vitest-environment happy-dom
/**
 * Пропс-сигнал поля доходит до компонента значением и реактивно: справочник, загруженный один
 * раз, — опции полей всех строк массива, в том числе добавленных после загрузки (ReFormer-zh9r).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { arrayOf, createForm, type FormModel } from '@reformer/core';
import { signal } from '@reformer/core/signals';
import { FormRenderer } from '../src/core/form-renderer';
import type { ArrayComponentProps } from '../src/core/types';

afterEach(cleanup);

interface Row {
  type: string;
}
interface Shape {
  rows: Row[];
}

/** Поле-список: число опций в атрибуте — по нему видно, что дошло до компонента. */
const Choice = ({ options = [], ...rest }: { options?: string[]; 'data-testid'?: string }) => (
  <select data-options={options.length} data-testid={rest['data-testid']} />
);

const List = ({ items = [] }: ArrayComponentProps) => (
  <div>
    {items.map((item) => (
      <div key={item.key}>{item.children}</div>
    ))}
  </div>
);

describe('пропс-сигнал поля', () => {
  it('опции из одного справочника — у всех строк, загрузка видна сразу', () => {
    const types = signal<string[]>([]);
    const bundle = createForm<Shape>({
      initial: { rows: arrayOf<Row>(() => ({ type: '' }), [{ type: '' }]) },
      schema: (model) => ({
        children: [
          {
            model: model.$.rows,
            component: List,
            item: (row: FormModel<Row>) => ({
              children: [
                { model: row.$.type, component: Choice, componentProps: { options: types } },
              ],
            }),
          },
        ],
      }),
    });
    render(<FormRenderer form={bundle} />);
    const counts = () =>
      screen.getAllByTestId(/^input-rows-\d-type$/).map((el) => el.getAttribute('data-options'));
    expect(counts()).toEqual(['0']);

    act(() => {
      types.value = ['дом', 'квартира'];
    });
    act(() => bundle.model.rows.push());

    expect(counts()).toEqual(['2', '2']);
  });
});
