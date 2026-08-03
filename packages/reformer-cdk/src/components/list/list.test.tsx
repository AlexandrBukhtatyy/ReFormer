/**
 * Unit-тесты CDK List — display-итерация массива модели (read-only брат FormArray).
 *
 * По конвенции пакета: инъекция контекста + renderToStaticMarkup (без jsdom). Реактивность на
 * мутацию массива покрывается интеграционными тестами renderer-react (ModelListRenderer).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FormProxy } from '@reformer/core';
import { List } from './List';
import { ListContext, type ListContextValue } from './ListContext';
import type { ListItem } from './types';

function item(id: string | number, index: number): ListItem<Record<string, unknown>> {
  return { control: { __id: id } as unknown as FormProxy<Record<string, unknown>>, index, id };
}

function ctx(items: ListItem<Record<string, unknown>>[]): ListContextValue {
  return { items, length: items.length, isEmpty: items.length === 0 };
}

const render = (items: ListItem<Record<string, unknown>>[], node: React.ReactElement) =>
  renderToStaticMarkup(<ListContext.Provider value={ctx(items)}>{node}</ListContext.Provider>);

describe('List.Items', () => {
  it('рендерит по одному узлу на элемент', () => {
    const html = render(
      [item('a', 0), item('b', 1), item('c', 2)],
      <List.Items>{({ index }) => <span>row-{index}</span>}</List.Items>
    );
    expect(html).toContain('row-0');
    expect(html).toContain('row-1');
    expect(html).toContain('row-2');
  });

  it('без className рендерит Fragment (без обёртки-контейнера)', () => {
    const html = render([item('a', 0)], <List.Items>{() => <b>x</b>}</List.Items>);
    expect(html).toBe('<b>x</b>');
  });

  it('с className оборачивает в контейнер (as по умолчанию div)', () => {
    const html = render(
      [item('a', 0)],
      <List.Items className="space-y-2">{() => <b>x</b>}</List.Items>
    );
    expect(html).toContain('<div class="space-y-2">');
  });

  it('as переопределяет тег контейнера', () => {
    const html = render(
      [item('a', 0)],
      <List.Items className="stack" as="ul">
        {() => <li>x</li>}
      </List.Items>
    );
    expect(html).toContain('<ul class="stack">');
  });
});

describe('List.Empty', () => {
  it('рендерит children когда список пуст', () => {
    expect(render([], <List.Empty>пусто</List.Empty>)).toContain('пусто');
  });

  it('ничего не рендерит когда есть элементы', () => {
    expect(render([item('a', 0)], <List.Empty>пусто</List.Empty>)).toBe('');
  });
});
