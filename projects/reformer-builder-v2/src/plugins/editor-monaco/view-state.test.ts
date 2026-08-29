/**
 * Тесты состояния вида: что в него входит, что отвергается и как оно переживает вкладку.
 *
 * @module plugins/editor-monaco/view-state.test
 */

import { describe, expect, it } from 'vitest';
import {
  createViewStateRegistry,
  isSameViewState,
  readViewState,
  type MonacoViewState,
} from './view-state';

const state: MonacoViewState = { scrollTop: 120, scrollLeft: 0, line: 8, column: 3 };

describe('readViewState', () => {
  it('пропускает свой снимок целиком', () => {
    expect(readViewState({ ...state })).toEqual(state);
  });

  it('отбрасывает лишние поля: выделению в состоянии вида не место', () => {
    expect(readViewState({ ...state, selection: [{ start: 1, end: 2 }] })).toEqual(state);
  });

  it.each([
    ['не объект', 'строка'],
    ['пусто', null],
    ['без прокрутки', { line: 1, column: 1 }],
    ['строка с нуля', { ...state, line: 0 }],
    ['отрицательная прокрутка', { ...state, scrollTop: -1 }],
    ['не число', { ...state, column: '3' }],
    ['бесконечность', { ...state, scrollTop: Number.POSITIVE_INFINITY }],
  ])('отвергает непонятное значение (%s): открыть сверху лучше, чем упасть', (_case, value) => {
    expect(readViewState(value)).toBeNull();
  });
});

describe('isSameViewState', () => {
  it('различает снимки по всем четырём полям', () => {
    expect(isSameViewState(state, { ...state })).toBe(true);
    expect(isSameViewState(state, { ...state, column: 4 })).toBe(false);
  });
});

describe('createViewStateRegistry', () => {
  it('отдаёт последний записанный снимок', () => {
    const registry = createViewStateRegistry();
    registry.record('fs:a.ts', state);
    registry.record('fs:a.ts', { ...state, line: 9 });
    expect(registry.peek('fs:a.ts')).toEqual({ ...state, line: 9 });
  });

  it('снимки документов не смешиваются: у каждой вкладки своя прокрутка', () => {
    const registry = createViewStateRegistry();
    registry.record('fs:a.ts', state);
    registry.record('fs:b.ts', { ...state, scrollTop: 0 });
    expect(registry.peek('fs:a.ts')?.scrollTop).toBe(120);
  });

  it('без записи отвечает «нет снимка», а не выдумывает начало', () => {
    expect(createViewStateRegistry().peek('fs:нет.ts')).toBeNull();
  });

  it('повторная запись равного снимка ничего не меняет', () => {
    const registry = createViewStateRegistry();
    registry.record('fs:a.ts', state);
    const first = registry.peek('fs:a.ts');
    registry.record('fs:a.ts', { ...state });
    expect(registry.peek('fs:a.ts')).toBe(first);
  });

  it('забывает документ: вкладку закрыли, восстанавливать нечего', () => {
    const registry = createViewStateRegistry();
    registry.record('fs:a.ts', state);
    registry.forget('fs:a.ts');
    expect(registry.peek('fs:a.ts')).toBeNull();
  });
});
