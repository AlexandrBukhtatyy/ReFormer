/**
 * Замечания ноды и признак блокирующих: `severity: 'warning'` отправку не блокирует.
 *
 * Список — {@link OwnedSignal}: снаружи только чтение, пишут его `set` и `clear`.
 *
 * @internal
 * @module form/nodes/state/issues
 */

import { computed, type ReadonlySignal } from '@preact/signals-core';
import { OwnedSignal } from './owned-signal';
import type { ValidationIssue } from '../../types/contracts';

export interface IssuesState {
  readonly list: ReadonlySignal<readonly ValidationIssue[]>;
  readonly blocking: ReadonlySignal<boolean>;
  set(issues: readonly ValidationIssue[]): void;
  clear(): void;
}

const NO_ISSUES: readonly ValidationIssue[] = [];

class Issues implements IssuesState {
  private readonly listSignal = new OwnedSignal<readonly ValidationIssue[]>(NO_ISSUES);
  readonly blocking: ReadonlySignal<boolean> = computed(() =>
    this.listSignal.value.some((issue) => issue.severity !== 'warning')
  );

  get list(): ReadonlySignal<readonly ValidationIssue[]> {
    return this.listSignal;
  }

  set(issues: readonly ValidationIssue[]): void {
    this.listSignal.set(issues);
  }

  clear(): void {
    this.listSignal.set([]);
  }
}

export function createIssues(): IssuesState {
  return new Issues();
}
