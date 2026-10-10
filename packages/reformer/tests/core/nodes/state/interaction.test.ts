/**
 * Модуль взаимодействия (`createInteraction`) сам по себе: флаги `touched` и `dirty`.
 *
 * Флаги независимы — нода решает, когда какой ставить (`markAsTouched`, `setValue`, `reset`).
 * Здесь — начальное состояние, независимость флагов, реактивность без лишних уведомлений и то,
 * что наружу отдаётся только чтение.
 */

import { describe, expect, it } from 'vitest';
import { effect, type Signal } from '@preact/signals-core';
import { createInteraction } from '../../../../src/form/nodes/state/interaction';

describe('interaction — touched и dirty', () => {
  it('изначально нода не тронута и не изменена', () => {
    const state = createInteraction();

    expect(state.touched.value).toBe(false);
    expect(state.dirty.value).toBe(false);
  });

  it('флаги независимы: запись одного не меняет другой', () => {
    const state = createInteraction();

    state.setDirty(true);
    expect(state.touched.value).toBe(false);

    state.setTouched(true);
    state.setDirty(false);
    expect(state.touched.value).toBe(true);
    expect(state.dirty.value).toBe(false);
  });

  it('подписчик флага будится только его сменой, а не записью другого флага', () => {
    const state = createInteraction();
    const touched: boolean[] = [];
    const stop = effect(() => {
      touched.push(state.touched.value);
    });

    state.setDirty(true);
    state.setTouched(true);
    state.setTouched(true);
    stop();

    expect(touched).toEqual([false, true]);
  });

  it('наружу — только чтение: флаги пишутся через setTouched и setDirty', () => {
    const state = createInteraction();

    expect(() => {
      (state.touched as Signal<boolean>).value = true;
    }).toThrow(TypeError);
    expect(() => {
      (state.dirty as Signal<boolean>).value = true;
    }).toThrow(TypeError);
  });

  it('каждый вызов — своё состояние', () => {
    const first = createInteraction();
    const second = createInteraction();

    first.setTouched(true);
    first.setDirty(true);

    expect(second.touched.value).toBe(false);
    expect(second.dirty.value).toBe(false);
  });
});
