/**
 * Тесты итога рабочей области, переживающего смену проекта.
 *
 * Проверяется не «подписка работает», а три утверждения, ради которых источник и написан:
 * до открытия проекта состояние выразимо, при смене проекта подписка переезжает на новый
 * итог, а после закрытия старый итог никого не будит.
 *
 * @module app/project-status.test
 */

import { describe, expect, it } from 'vitest';

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import {
  NO_WORKSPACE_STATUS,
  type WorkspaceStatusSnapshot,
  type WorkspaceStatusSource,
} from '@/shell/platform/ui/status';
import { createProjectStatusSource } from './project-status';

/** Итог, которым можно управлять руками. */
function fakeStatus(initial: WorkspaceStatusSnapshot) {
  let snapshot = Object.freeze(initial);
  const listeners = new Set<() => void>();
  const source: WorkspaceStatusSource = {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
  return {
    source,
    subscribers: () => listeners.size,
    set(next: WorkspaceStatusSnapshot) {
      snapshot = Object.freeze(next);
      for (const listener of [...listeners]) listener();
    },
  };
}

/** Держатель проекта в объёме, который читает строка состояния. */
function fakeProject() {
  let current: { readonly status: WorkspaceStatusSource } | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
    set(next: { readonly status: WorkspaceStatusSource } | null) {
      current = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

const dirty = (count: number): WorkspaceStatusSnapshot => ({
  hasWorkspace: true,
  dirtyCount: count,
  externallyChangedCount: 0,
});

describe('итог рабочей области поверх держателя проекта', () => {
  it('без проекта отвечает «рабочая область не открыта»', () => {
    const status = createProjectStatusSource(fakeProject());

    expect(status.get()).toBe(NO_WORKSPACE_STATUS);
  });

  it('после открытия проекта отдаёт его итог и будит подписчиков', () => {
    const project = fakeProject();
    const status = createProjectStatusSource(project);
    let woken = 0;
    status.subscribe(() => {
      woken += 1;
    });

    project.set({ status: fakeStatus(dirty(2)).source });

    expect(status.get()).toEqual(dirty(2));
    expect(woken).toBe(1);
  });

  it('изменение итога открытого проекта доходит до подписчика', () => {
    const project = fakeProject();
    const session = fakeStatus(dirty(0));
    project.set({ status: session.source });
    const status = createProjectStatusSource(project);
    let woken = 0;
    status.subscribe(() => {
      woken += 1;
    });

    session.set(dirty(1));

    expect(status.get()).toEqual(dirty(1));
    expect(woken).toBe(1);
  });

  it('снимок стабилен по ссылке, пока итог не менялся', () => {
    const project = fakeProject();
    project.set({ status: fakeStatus(dirty(1)).source });
    const status = createProjectStatusSource(project);

    expect(status.get()).toBe(status.get());
  });

  it('закрытие проекта возвращает состояние «не открыта» и отпускает прежний итог', () => {
    const project = fakeProject();
    const session = fakeStatus(dirty(3));
    project.set({ status: session.source });
    const status = createProjectStatusSource(project);
    expect(session.subscribers()).toBe(1);

    project.set(null);

    expect(status.get()).toBe(NO_WORKSPACE_STATUS);
    expect(session.subscribers()).toBe(0);
  });

  it('после `dispose` подписки сняты со всех сторон', () => {
    const project = fakeProject();
    const session = fakeStatus(dirty(1));
    project.set({ status: session.source });
    const status = createProjectStatusSource(project);
    let woken = 0;
    status.subscribe(() => {
      woken += 1;
    });

    status.dispose();
    session.set(dirty(2));

    expect(session.subscribers()).toBe(0);
    expect(woken).toBe(0);
  });
});
