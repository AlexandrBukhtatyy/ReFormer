/**
 * Тесты выделения: щелчки, переезд на `focus` и чистка исчезнувших адресов.
 *
 * @module plugins/editor-schema/selection.test
 */

import { describe, expect, it } from 'vitest';
import {
  anchorOf,
  pruneSelection,
  selectNode,
  selectionAfterApply,
  selectionEquals,
} from './selection';

const ORDER = ['a', 'b', 'c', 'd'];
const ALL_ALIVE = (): boolean => true;

describe('selectNode', () => {
  it('обычный щелчок оставляет один узел', () => {
    expect(selectNode(['a', 'b'], 'c', 'replace')).toEqual(['c']);
  });

  it('Ctrl добавляет и убирает, не трогая остальных', () => {
    expect(selectNode(['a'], 'c', 'toggle')).toEqual(['a', 'c']);
    expect(selectNode(['a', 'c'], 'a', 'toggle')).toEqual(['c']);
  });

  it('Shift берёт диапазон от якоря по порядку строк', () => {
    expect(selectNode(['b'], 'd', 'range', ORDER)).toEqual(['b', 'c', 'd']);
    // Направление неважно: диапазон один и тот же.
    expect(selectNode(['d'], 'b', 'range', ORDER)).toEqual(['b', 'c', 'd']);
  });

  it('Shift без якоря ведёт себя как обычный щелчок', () => {
    expect(selectNode([], 'c', 'range', ORDER)).toEqual(['c']);
  });

  it('Shift по узлу вне развёртки не расширяет ничего', () => {
    expect(selectNode(['a'], 'z', 'range', ORDER)).toEqual(['z']);
  });

  it('якорь — последний добавленный', () => {
    expect(anchorOf(['a', 'c'])).toBe('c');
    expect(anchorOf([])).toBeUndefined();
  });
});

describe('selectionAfterApply', () => {
  it('переезжает на `focus` операции', () => {
    expect(selectionAfterApply(['a', 'b'], 'c', ALL_ALIVE)).toEqual(['c']);
  });

  it('без `focus` чистит адреса, которых в модели больше нет', () => {
    expect(selectionAfterApply(['a', 'b'], undefined, (id) => id === 'a')).toEqual(['a']);
  });

  it('без изменений возвращает ту же ссылку — снимок сравнивается по ней', () => {
    const selection = ['a', 'b'];
    expect(selectionAfterApply(selection, undefined, ALL_ALIVE)).toBe(selection);
    expect(pruneSelection(selection, ALL_ALIVE)).toBe(selection);
  });
});

describe('selectionEquals', () => {
  it('сравнивает по содержимому и порядку', () => {
    expect(selectionEquals(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(selectionEquals(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(selectionEquals(['a'], ['a', 'b'])).toBe(false);
  });
});
