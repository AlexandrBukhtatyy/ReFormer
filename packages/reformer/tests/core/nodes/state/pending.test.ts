/**
 * Модуль ожидания проверки (`createPending`) сам по себе: счётчик прогонов async-правил.
 *
 * Раннер валидации отмечает начало и конец прогона парой вызовов `mark(true)` / `mark(false)`;
 * прогоны пересекаются (устаревший ещё не закончился, а новый уже начат), поэтому модуль считает
 * их, а не хранит флаг. Здесь — счёт пересекающихся прогонов, нижняя граница счётчика (лишнее
 * снятие отметки не уводит его в минус и не «съедает» следующий прогон) и уведомления только на
 * границе «ждёт / не ждёт».
 */

import { describe, expect, it } from 'vitest';
import { effect } from '@preact/signals-core';
import { createPending } from '../../../../src/form/nodes/state/pending';

describe('pending — счётчик прогонов async-правил', () => {
  it('изначально нода ничего не ждёт', () => {
    expect(createPending().active.value).toBe(false);
  });

  it('ожидание держится, пока не снята отметка каждого начатого прогона', () => {
    const state = createPending();

    state.mark(true);
    state.mark(true);
    state.mark(true);
    state.mark(false);
    state.mark(false);
    expect(state.active.value).toBe(true);

    state.mark(false);
    expect(state.active.value).toBe(false);
  });

  it('лишние снятия не уводят счётчик ниже нуля: следующий прогон снова виден', () => {
    const state = createPending();

    state.mark(false);
    state.mark(false);
    state.mark(false);
    expect(state.active.value).toBe(false);

    state.mark(true);
    expect(state.active.value).toBe(true);

    state.mark(false);
    expect(state.active.value).toBe(false);
  });

  it('снятие после завершения всех прогонов не трогает новый прогон', () => {
    const state = createPending();
    state.mark(true);
    state.mark(false);

    // Опоздавшее снятие уже завершённого прогона: счётчик стоит на нуле.
    state.mark(false);
    state.mark(true);

    expect(state.active.value).toBe(true);
  });

  it('подписчик будится только на границе «ждёт / не ждёт»', () => {
    const state = createPending();
    const seen: boolean[] = [];
    const stop = effect(() => {
      seen.push(state.active.value);
    });

    state.mark(true);
    state.mark(true);
    state.mark(false);
    state.mark(false);
    state.mark(false);
    stop();

    expect(seen).toEqual([false, true, false]);
  });

  it('каждый вызов — свой счётчик', () => {
    const first = createPending();
    const second = createPending();

    first.mark(true);

    expect(second.active.value).toBe(false);
  });
});
