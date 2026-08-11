import { describe, expect, it } from 'vitest';
import type { Element, Root } from 'hast';
import { rehypeSourceLine } from './rehype-source-line';

/** Элемент с позицией в исходнике (как его отдаёт mdast-util-to-hast). */
const el = (tagName: string, line: number | null, children: Element['children'] = []): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
  ...(line == null ? {} : { position: { start: { line, column: 1 }, end: { line, column: 1 } } }),
});

const run = (tree: Root): Root => {
  rehypeSourceLine()(tree);
  return tree;
};

const lineOf = (node: Element): unknown => node.properties?.dataLine;

describe('rehypeSourceLine', () => {
  it('размечает блочные элементы верхнего уровня', () => {
    const h1 = el('h1', 1);
    const p = el('p', 3);
    run({ type: 'root', children: [h1, p] });
    expect(lineOf(h1)).toBe(1);
    expect(lineOf(p)).toBe(3);
  });

  it('спускается внутрь: пункты списка и строки таблицы тоже получают метку', () => {
    const li1 = el('li', 5);
    const li2 = el('li', 6);
    const ul = el('ul', 5, [li1, li2]);
    run({ type: 'root', children: [ul] });
    expect(lineOf(ul)).toBe(5);
    expect(lineOf(li1)).toBe(5);
    expect(lineOf(li2)).toBe(6);
  });

  it('инлайновые элементы не размечает', () => {
    const em = el('em', 2);
    const p = el('p', 2, [em]);
    run({ type: 'root', children: [p] });
    expect(lineOf(p)).toBe(2);
    expect(lineOf(em)).toBeUndefined();
  });

  it('внутрь блока кода не спускается', () => {
    const code = el('code', 8);
    const pre = el('pre', 8, [code]);
    run({ type: 'root', children: [pre] });
    expect(lineOf(pre)).toBe(8);
    expect(lineOf(code)).toBeUndefined();
  });

  it('узлы без позиции пропускаются, существующие свойства сохраняются', () => {
    const generated = el('p', null);
    const withProps: Element = { ...el('h2', 4), properties: { id: 'intro' } };
    run({ type: 'root', children: [generated, withProps] });
    expect(lineOf(generated)).toBeUndefined();
    expect(withProps.properties).toEqual({ id: 'intro', dataLine: 4 });
  });
});
