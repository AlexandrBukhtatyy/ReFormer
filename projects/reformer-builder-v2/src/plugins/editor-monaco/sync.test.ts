/**
 * Тесты связи Monaco с буфером — то есть главного правила редактора.
 *
 * Проверяется ровно то, что нельзя проверить с Monaco в `node`: когда буфер
 * перерисовывается, когда откладывается и когда своя же запись отсеивается как эхо.
 *
 * @module plugins/editor-monaco/sync.test
 */

import { describe, expect, it } from 'vitest';
import { createSyncState, reduceSync, type SyncState } from './sync';

/** Прогоняет цепочку событий, отдавая последнее состояние и все действия по дороге. */
function run(events: Parameters<typeof reduceSync>[1][], from: SyncState = createSyncState()) {
  let state = from;
  const actions = events.map((event) => {
    const outcome = reduceSync(state, event);
    state = outcome.state;
    return outcome.action;
  });
  return { state, actions };
}

describe('reduceSync', () => {
  describe('печать', () => {
    it('уходит в рабочую копию, а не в модель', () => {
      const { actions } = run([{ kind: 'typed', text: 'a' }]);
      expect(actions[0]).toEqual({ kind: 'write', text: 'a' });
    });

    it('запоминается как эхо, чтобы не вернуться правкой извне', () => {
      const { state } = run([{ kind: 'typed', text: 'a' }]);
      expect(state.echoes).toEqual(['a']);
    });
  });

  describe('эхо собственной записи', () => {
    it('не перерисовывает редактор', () => {
      const { actions } = run([
        { kind: 'typed', text: 'a' },
        { kind: 'buffer', text: 'a', editorText: 'ab', focused: true },
      ]);
      expect(actions[1]).toEqual({ kind: 'none', reason: 'echo' });
    });

    it('снимается из списка по одному вхождению: тот же текст бывает в пути дважды', () => {
      const { state } = run([
        { kind: 'typed', text: 'a' },
        { kind: 'typed', text: 'ab' },
        { kind: 'typed', text: 'a' },
        { kind: 'buffer', text: 'a', editorText: 'a', focused: true },
      ]);
      expect(state.echoes).toEqual(['ab', 'a']);
    });

    it('снимается и при отказе записи — иначе список растёт весь сеанс', () => {
      const { state } = run([
        { kind: 'typed', text: 'a' },
        { kind: 'written', text: 'a' },
      ]);
      expect(state.echoes).toEqual([]);
    });
  });

  describe('внешняя правка', () => {
    it('перерисовывает редактор, когда он не в фокусе', () => {
      const { actions } = run([
        { kind: 'buffer', text: 'извне', editorText: 'было', focused: false },
      ]);
      expect(actions[0]).toEqual({ kind: 'apply', text: 'извне' });
    });

    it('ОТКЛАДЫВАЕТСЯ, пока человек печатает', () => {
      const { state, actions } = run([
        { kind: 'buffer', text: 'извне', editorText: 'было', focused: true },
      ]);
      expect(actions[0]).toEqual({ kind: 'none', reason: 'focused' });
      expect(state.pending).toBe('извне');
    });

    it('ничего не делает, когда в редакторе уже ровно этот текст', () => {
      const { actions } = run([
        { kind: 'buffer', text: 'одно и то же', editorText: 'одно и то же', focused: false },
      ]);
      expect(actions[0]).toEqual({ kind: 'none', reason: 'same' });
    });

    it('вытесняет прежнее отложенное: показывать надо последнее состояние документа', () => {
      const { state } = run([
        { kind: 'buffer', text: 'первое', editorText: 'своё', focused: true },
        { kind: 'buffer', text: 'второе', editorText: 'своё', focused: true },
      ]);
      expect(state.pending).toBe('второе');
    });
  });

  describe('уход фокуса', () => {
    it('выполняет отложенную перерисовку', () => {
      const { actions } = run([
        { kind: 'buffer', text: 'извне', editorText: 'своё', focused: true },
        { kind: 'blur', editorText: 'своё' },
      ]);
      expect(actions[1]).toEqual({ kind: 'apply', text: 'извне' });
    });

    it('приоритет у того, кто печатает: набранное отменяет отложенное', () => {
      const { state, actions } = run([
        { kind: 'buffer', text: 'извне', editorText: 'своё', focused: true },
        { kind: 'typed', text: 'своё и ещё' },
        { kind: 'blur', editorText: 'своё и ещё' },
      ]);
      expect(state.pending).toBeNull();
      expect(actions[2]).toEqual({ kind: 'none', reason: 'no-pending' });
    });

    it('без отложенного не делает ничего', () => {
      const { actions } = run([{ kind: 'blur', editorText: 'что было, то и есть' }]);
      expect(actions[0]).toEqual({ kind: 'none', reason: 'no-pending' });
    });

    it('не перерисовывает, если отложенное совпало с тем, что на экране', () => {
      const { state, actions } = run([
        { kind: 'buffer', text: 'извне', editorText: 'своё', focused: true },
        { kind: 'blur', editorText: 'извне' },
      ]);
      expect(actions[1]).toEqual({ kind: 'none', reason: 'same' });
      expect(state.pending).toBeNull();
    });
  });

  it('состояние неизменяемо: шаг отдаёт новое, а прежнее годится для сравнения', () => {
    const before = createSyncState();
    const after = reduceSync(before, { kind: 'typed', text: 'a' }).state;
    expect(before.echoes).toEqual([]);
    expect(after).not.toBe(before);
  });
});
