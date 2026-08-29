/**
 * Тесты перевода «узел → диапазон» разбором текста с позициями.
 *
 * @module plugins/editor-monaco/node-ranges.test
 */

import { describe, expect, it } from 'vitest';
import { indexNodeRanges } from './node-ranges';

/** Кусок текста по диапазону: так утверждения читаются, а не считаются в уме. */
function slice(text: string, range: { start: number; end: number }): string {
  return text.slice(range.start, range.end);
}

describe('indexNodeRanges', () => {
  it('находит узел по идентификатору и указывает на сам идентификатор', () => {
    const text = '{ "$nodeId": "ab12cd34", "component": "Input" }';
    const found = indexNodeRanges(text).get('ab12cd34');
    expect(found).toBeDefined();
    expect(slice(text, found!.anchor)).toBe('"ab12cd34"');
  });

  it('запоминает и объект узла целиком — от скобки до скобки', () => {
    const text = '{ "root": { "$nodeId": "aaaa1111" } }';
    const found = indexNodeRanges(text).get('aaaa1111');
    expect(slice(text, found!.node)).toBe('{ "$nodeId": "aaaa1111" }');
  });

  it('различает вложенные узлы: идентификатор достаётся ближайшему объекту', () => {
    const text = `{
      "$nodeId": "outer000",
      "children": [{ "$nodeId": "inner000", "component": "Input" }]
    }`;
    const index = indexNodeRanges(text);
    expect(slice(text, index.get('inner000')!.node)).toBe(
      '{ "$nodeId": "inner000", "component": "Input" }'
    );
    expect(slice(text, index.get('outer000')!.node).startsWith('{')).toBe(true);
    expect(slice(text, index.get('outer000')!.node).endsWith('}')).toBe(true);
  });

  it('не принимает за идентификатор строку, которая просто равна ключу', () => {
    const text = '{ "title": "$nodeId", "$nodeId": "real0000" }';
    const index = indexNodeRanges(text);
    expect([...index.keys()]).toEqual(['real0000']);
  });

  it('не путается на экранированной кавычке внутри строки', () => {
    const text = '{ "title": "он сказал \\" и ушёл", "$nodeId": "esc00000" }';
    expect(indexNodeRanges(text).has('esc00000')).toBe(true);
  });

  it('не принимает элемент массива за узел: идентификатор кладётся на объект', () => {
    const text = '{ "list": ["$nodeId", "notanode"] }';
    expect(indexNodeRanges(text).size).toBe(0);
  });

  it('отдаёт найденное до обрыва: недописанный JSON — нормальное состояние буфера', () => {
    const text = '{ "a": { "$nodeId": "done0000" }, "b": { "$nodeId": "half';
    const index = indexNodeRanges(text);
    expect(index.has('done0000')).toBe(true);
    expect(index.has('half')).toBe(false);
  });

  it('при повторе идентификатора выигрывает первое вхождение', () => {
    const text = '[{ "$nodeId": "dup00000", "n": 1 }, { "$nodeId": "dup00000", "n": 2 }]';
    const found = indexNodeRanges(text).get('dup00000');
    expect(slice(text, found!.node)).toBe('{ "$nodeId": "dup00000", "n": 1 }');
  });

  it('пустой текст даёт пустой указатель, а не отказ', () => {
    expect(indexNodeRanges('').size).toBe(0);
  });
});
