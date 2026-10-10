/**
 * Unit tests: модули состояния ноды формы по отдельности — взаимодействие, замечания,
 * доступность, ожидание проверки и состояние компонента.
 */

import { describe, it, expect } from 'vitest';
import { effect } from '@preact/signals-core';
import {
  createAvailability,
  createComponentState,
  createInteraction,
  createIssues,
  createPending,
} from '../../../src/form/nodes/state';

describe('createInteraction', () => {
  it('touched и dirty — независимые флаги, по умолчанию false', () => {
    const state = createInteraction();
    expect(state.touched.value).toBe(false);
    expect(state.dirty.value).toBe(false);

    state.setTouched(true);
    expect(state.touched.value).toBe(true);
    expect(state.dirty.value).toBe(false);

    state.setDirty(true);
    state.setTouched(false);
    expect(state.touched.value).toBe(false);
    expect(state.dirty.value).toBe(true);
  });
});

describe('createIssues', () => {
  it('blocking — есть замечание без severity: warning', () => {
    const state = createIssues();
    expect(state.blocking.value).toBe(false);

    state.set([{ code: 'soft', severity: 'warning' }]);
    expect(state.blocking.value).toBe(false);

    state.set([{ code: 'soft', severity: 'warning' }, { code: 'required' }]);
    expect(state.blocking.value).toBe(true);

    state.clear();
    expect(state.list.value).toEqual([]);
    expect(state.blocking.value).toBe(false);
  });

  it('list отдаёт ровно поставленный список', () => {
    const state = createIssues();
    const issues = [{ code: 'taken', params: { login: 'admin' } }];
    state.set(issues);
    expect(state.list.value).toBe(issues);
  });
});

describe('createAvailability', () => {
  it('начальное состояние и переключение', () => {
    expect(createAvailability().disabled.value).toBe(false);
    const state = createAvailability(true);
    expect(state.disabled.value).toBe(true);
    state.setDisabled(false);
    expect(state.disabled.value).toBe(false);
  });
});

describe('createPending', () => {
  it('прогоны считаются: ожидание держится, пока идёт хотя бы один', () => {
    const state = createPending();
    state.mark(true);
    state.mark(true);
    expect(state.active.value).toBe(true);

    state.mark(false);
    expect(state.active.value).toBe(true);

    state.mark(false);
    expect(state.active.value).toBe(false);
  });

  it('лишнее снятие отметки не уводит счётчик ниже нуля', () => {
    const state = createPending();
    state.mark(false);
    state.mark(true);
    expect(state.active.value).toBe(true);
  });
});

describe('createComponentState', () => {
  it('update сливает правку поверх пропсов и уведомляет подписчиков', () => {
    const state = createComponentState({ label: 'Email', required: true });
    const seen: unknown[] = [];
    const stop = effect(() => {
      seen.push(state.props.value);
    });

    state.update({ placeholder: 'name@mail.com' });
    stop();

    expect(state.props.value).toEqual({
      label: 'Email',
      required: true,
      placeholder: 'name@mail.com',
    });
    expect(seen).toHaveLength(2);
  });

  it('без начальных пропсов — пустой объект', () => {
    expect(createComponentState().props.value).toEqual({});
  });
});
