/**
 * Модуль замечаний (`createIssues`) сам по себе: список замечаний и признак блокирующих.
 *
 * `blocking` — основа валидности поля: замечание с `severity: 'warning'` отправку не блокирует,
 * любое другое — блокирует. Здесь — таблица уровней важности, то, что список хранится как
 * передан, очистка и то, что подписчик `blocking` будится сменой признака, а не каждой правкой
 * списка.
 */

import { describe, expect, it } from 'vitest';
import { effect, type Signal } from '@preact/signals-core';
import { createIssues } from '../../../../src/form/nodes/state/issues';
import type { ValidationIssue } from '../../../../src/form/types/contracts';

const error: ValidationIssue = { code: 'required' };
const explicitError: ValidationIssue = { code: 'min', severity: 'error' };
const warning: ValidationIssue = { code: 'weak', severity: 'warning' };

describe('issues — список и признак блокирующих', () => {
  it('изначально замечаний нет и ничего не блокирует', () => {
    const state = createIssues();

    expect(state.list.value).toEqual([]);
    expect(state.blocking.value).toBe(false);
  });

  it.each<[string, ValidationIssue[], boolean]>([
    ['пустой список', [], false],
    ['замечание без severity', [error], true],
    ["severity: 'error'", [explicitError], true],
    ['только предупреждения', [warning, { ...warning, code: 'other' }], false],
    ['предупреждение и ошибка', [warning, error], true],
  ])('blocking: %s → %s', (_label, issues, blocking) => {
    const state = createIssues();

    state.set(issues);

    expect(state.blocking.value).toBe(blocking);
  });

  it('незнакомый уровень важности блокирует: не блокирует только warning', () => {
    const state = createIssues();

    state.set([{ code: 'note', severity: 'info' as ValidationIssue['severity'] }]);

    expect(state.blocking.value).toBe(true);
  });

  it('set хранит ровно переданный список, следующий set его заменяет', () => {
    const state = createIssues();
    const first = [error];
    const second = [warning];

    state.set(first);
    expect(state.list.value).toBe(first);

    state.set(second);
    expect(state.list.value).toBe(second);
  });

  it('clear снимает все замечания и признак блокирующих', () => {
    const state = createIssues();
    state.set([warning, error]);

    state.clear();

    expect(state.list.value).toEqual([]);
    expect(state.blocking.value).toBe(false);
  });

  it('подписчик blocking будится сменой признака, а не каждой правкой списка', () => {
    const state = createIssues();
    const seen: boolean[] = [];
    const stop = effect(() => {
      seen.push(state.blocking.value);
    });

    state.set([warning]);
    state.set([warning, { ...warning, code: 'other' }]);
    state.set([error]);
    state.set([error, explicitError]);
    state.clear();
    stop();

    expect(seen).toEqual([false, true, false]);
  });

  it('наружу — только чтение: список пишется через set и clear', () => {
    const state = createIssues();

    expect(() => {
      (state.list as Signal<readonly ValidationIssue[]>).value = [error];
    }).toThrow(TypeError);
    expect(state.list.value).toEqual([]);
  });
});
