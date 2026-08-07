/**
 * Unit-тесты ui-kit FormArray — editable-секция массива для renderer-json (`$component(FormArray)`).
 * (Отдельно от form-array.test.tsx, который покрывает FormArraySection — React/TS-контракт.)
 *
 * Рендерим настоящий путь: узел `{ array, item, component: FormArray }` через `FormRenderer`.
 * Проверяем хром + data-testid, совместимые со встроенной секцией (миграция эквивалентна).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormRenderer } from '@reformer/renderer-react';
import { FormArray } from './variants/base/form-array';

/* eslint-disable @typescript-eslint/no-explicit-any */

function fakeArray(items: any[]): any {
  return {
    __path: 'items',
    length: items.length,
    at: (i: number) => items[i],
    map: (fn: any) => items.map(fn),
    push: () => {},
    removeAt: () => {},
    move: () => {},
  };
}

const render = (node: any): string => renderToStaticMarkup(<FormRenderer render={() => node} />);

const faNode = (items: any[], componentProps?: any) => ({
  array: fakeArray(items),
  item: (im: any) => ({ component: 'span', children: [im.name] }),
  component: FormArray,
  initialValue: () => ({}),
  componentProps,
});

describe('FormArray (ui-kit, renderer-json)', () => {
  it('рендерит заголовок, кнопку «Добавить» и карточки элементов', () => {
    const html = render(
      faNode([{ name: 'a' }, { name: 'b' }], { title: 'Созаёмщики', addButtonLabel: '+ Добавить' })
    );
    expect(html).toContain('Созаёмщики');
    expect(html).toContain('data-testid="array-add"');
    expect(html).toContain('data-testid="array-item-0"');
    expect(html).toContain('data-testid="array-item-1"');
  });

  it('itemLabel-функция получает (model, index)', () => {
    const html = render(
      faNode([{ name: 'x' }, { name: 'y' }], {
        title: 'T',
        itemLabel: (_m: any, i: number) => `Строка #${i + 1}`,
      })
    );
    expect(html).toContain('Строка #1');
    expect(html).toContain('Строка #2');
  });

  it('кнопка удаления на элемент при length>1, и нет при единственном', () => {
    const many = render(faNode([{ name: 'a' }, { name: 'b' }], { title: 'T' }));
    expect(many).toContain('data-testid="array-item-0-remove"');
    const one = render(faNode([{ name: 'a' }], { title: 'T' }));
    expect(one).not.toContain('-remove"');
  });

  it('reorderable добавляет кнопки перестановки', () => {
    const html = render(faNode([{ name: 'a' }, { name: 'b' }], { title: 'T', reorderable: true }));
    expect(html).toContain('array-item-0-move-up');
    expect(html).toContain('array-item-0-move-down');
  });

  it('emptyMessage при пустом массиве', () => {
    const html = render(faNode([], { title: 'T', emptyMessage: 'Пусто пока' }));
    expect(html).toContain('Пусто пока');
  });
});
