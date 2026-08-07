/**
 * Unit-тесты ui-kit List — chrome-less display-список для renderer-json.
 *
 * Рендерим НАСТОЯЩИЙ путь: узел `{ array, item, component: List }` через `FormRenderer`
 * (renderToStaticMarkup, без DOM-окружения) — так же, как это делает диспетчер рендерера.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormRenderer } from '@reformer/renderer-react';
import { List } from './variants/base/list';

/* eslint-disable @typescript-eslint/no-explicit-any */

function fakeArray(items: any[]): any {
  return {
    __path: 'rows',
    length: items.length,
    at: (i: number) => items[i],
    map: (fn: any) => items.map(fn),
    push: () => {},
    removeAt: () => {},
    move: () => {},
  };
}

const render = (node: any): string => renderToStaticMarkup(<FormRenderer render={() => node} />);

const listNode = (items: any[], componentProps?: any) => ({
  array: fakeArray(items),
  item: (im: any) => ({ component: 'span', children: [im.label] }),
  component: List,
  initialValue: () => ({}),
  componentProps,
});

describe('List (ui-kit)', () => {
  it('рендерит элементы в контейнере role="list", без хрома', () => {
    const html = render(listNode([{ label: 'A' }, { label: 'B' }]));
    expect(html).toContain('role="list"');
    expect(html).toContain('A');
    expect(html).toContain('B');
    expect(html).not.toContain('array-add'); // нет кнопки «Добавить»
  });

  it('мержит className поверх space-y-2 и проставляет data-testid', () => {
    const html = render(listNode([{ label: 'A' }], { className: 'mt-4', testId: 'alerts' }));
    expect(html).toContain('space-y-2');
    expect(html).toContain('mt-4');
    expect(html).toContain('data-testid="alerts"');
  });
});
