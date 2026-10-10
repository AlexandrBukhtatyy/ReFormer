/**
 * Замечания ноды и признак блокирующих: `severity: 'warning'` отправку не блокирует.
 *
 * @internal
 * @module form/nodes/state/issues
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationIssue } from '../../types/contracts';

export interface IssuesState {
  readonly list: ReadonlySignal<readonly ValidationIssue[]>;
  readonly blocking: ReadonlySignal<boolean>;
  set(issues: readonly ValidationIssue[]): void;
  clear(): void;
}

export function createIssues(): IssuesState {
  const list = signal<readonly ValidationIssue[]>([]);
  return {
    list: computed(() => list.value),
    blocking: computed(() => list.value.some((issue) => issue.severity !== 'warning')),
    set: (issues) => {
      list.value = issues;
    },
    clear: () => {
      list.value = [];
    },
  };
}
