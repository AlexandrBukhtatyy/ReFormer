/**
 * Модуль доступности ноды (`createAvailability`) сам по себе — без ноды и формы.
 *
 * Модуль держит одну сторону состояния: отключена ли нода. Что при отключении делать с
 * замечаниями, решает нода, поэтому здесь только флаг: начальное значение, переключение,
 * реактивность и то, что наружу отдаётся чтение, а не записываемый сигнал.
 */

import { describe, expect, it } from 'vitest';
import { effect, type Signal } from '@preact/signals-core';
import { createAvailability } from '../../../../src/form/nodes/state/availability';

describe('availability — флаг disabled', () => {
  it('без аргумента нода включена, с true — создаётся отключённой', () => {
    expect(createAvailability().disabled.value).toBe(false);
    expect(createAvailability(false).disabled.value).toBe(false);
    expect(createAvailability(true).disabled.value).toBe(true);
  });

  it('setDisabled переключает флаг в обе стороны', () => {
    const state = createAvailability();

    state.setDisabled(true);
    expect(state.disabled.value).toBe(true);

    state.setDisabled(false);
    expect(state.disabled.value).toBe(false);
  });

  it('подписчик узнаёт о смене флага, повторная запись того же значения его не будит', () => {
    const state = createAvailability();
    const seen: boolean[] = [];
    const stop = effect(() => {
      seen.push(state.disabled.value);
    });

    state.setDisabled(true);
    state.setDisabled(true);
    state.setDisabled(false);
    stop();

    expect(seen).toEqual([false, true, false]);
  });

  it('наружу — только чтение: записать флаг мимо setDisabled нельзя', () => {
    const state = createAvailability();

    expect(() => {
      (state.disabled as Signal<boolean>).value = true;
    }).toThrow(TypeError);
    expect(state.disabled.value).toBe(false);
  });

  it('каждый вызов — своё состояние', () => {
    const first = createAvailability();
    const second = createAvailability();

    first.setDisabled(true);

    expect(second.disabled.value).toBe(false);
  });
});
