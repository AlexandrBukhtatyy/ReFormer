/**
 * Тесты состояния вида: что в него входит, что отвергается и как оно переживает вкладку.
 *
 * @module plugins/editor-monaco/sync/view-state.test
 */

import { describe, expect, it } from 'vitest';
import type { EditorViewStateSlice } from '@/sdk';
import { isSameViewState, readViewState, viewStatesOver, type MonacoViewState } from './view-state';

const state: MonacoViewState = { scrollTop: 120, scrollLeft: 0, line: 8, column: 3 };

/**
 * Хранилище оболочки в объёме вида — картой и со счётчиком записей.
 *
 * Двойник, а не настоящее `createEditorViewStates`: плагин платформу не импортирует, и это
 * тот самый случай, ради которого вид принимает СРЕЗ, а не конкретное хранилище. Счётчик
 * нужен одному утверждению — что повторная запись равного снимка до хранилища не доходит.
 */
function memorySlice(): EditorViewStateSlice & { readonly writes: () => number } {
  const states = new Map<string, unknown>();
  let writes = 0;
  return {
    record(id, value) {
      writes += 1;
      states.set(id, value);
    },
    peek: (id) => states.get(id),
    forget(id) {
      states.delete(id);
    },
    writes: () => writes,
  };
}

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

describe('viewStatesOver', () => {
  it('отдаёт последний записанный снимок', () => {
    const registry = viewStatesOver(memorySlice());
    registry.record('fs:a.ts', state);
    registry.record('fs:a.ts', { ...state, line: 9 });
    expect(registry.peek('fs:a.ts')).toEqual({ ...state, line: 9 });
  });

  it('снимки документов не смешиваются: у каждой вкладки своя прокрутка', () => {
    const registry = viewStatesOver(memorySlice());
    registry.record('fs:a.ts', state);
    registry.record('fs:b.ts', { ...state, scrollTop: 0 });
    expect(registry.peek('fs:a.ts')?.scrollTop).toBe(120);
  });

  it('без записи отвечает «нет снимка», а не выдумывает начало', () => {
    expect(viewStatesOver(memorySlice()).peek('fs:нет.ts')).toBeNull();
  });

  it('чужой снимок в хранилище равносилен его отсутствию, а не падению', () => {
    // В общем хранилище лежат снимки ВСЕХ редакторов, и под ключом этого могло остаться
    // значение прошлой версии — вид обязан его отвергнуть, а не отдать как свой.
    const slice = memorySlice();
    slice.record('fs:a.ts', { collapsed: ['узел'] });
    expect(viewStatesOver(slice).peek('fs:a.ts')).toBeNull();
  });

  it('повторная запись равного снимка до хранилища не доходит', () => {
    // Прокрутка сыплет событиями покадрово: без этого хранилище переписывалось бы на каждый
    // кадр, а состояние у него теперь общее на все редакторы.
    const slice = memorySlice();
    const registry = viewStatesOver(slice);
    registry.record('fs:a.ts', state);
    registry.record('fs:a.ts', { ...state });
    expect(slice.writes()).toBe(1);
    expect(registry.peek('fs:a.ts')).toEqual(state);
  });

  it('забывает документ: вкладку закрыли, восстанавливать нечего', () => {
    const registry = viewStatesOver(memorySlice());
    registry.record('fs:a.ts', state);
    registry.forget('fs:a.ts');
    expect(registry.peek('fs:a.ts')).toBeNull();
  });

  it('виды на ОДНО хранилище видят снимки друг друга: общее — оно, а не объект вида', () => {
    // То, ради чего реестр переехал в платформу: раньше «тот же объект» приходилось раздавать
    // композицией троим, и второй экземпляр молча терял позицию курсора.
    const slice = memorySlice();
    viewStatesOver(slice).record('fs:a.ts', state);
    expect(viewStatesOver(slice).peek('fs:a.ts')).toEqual(state);
  });
});
