/**
 * Агрегированные сигналы контейнера (группа, массив под-форм): состояние из детей и своих
 * замечаний.
 *
 * @internal
 * @module form/aggregate-signals
 */

import { computed, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationIssue } from './types/contracts';
import type { FormNode } from './types/nodes';

export interface AggregateSignals {
  /** Своих замечаний нет, и каждый включённый ребёнок валиден. */
  valid: ReadonlySignal<boolean>;
  invalid: ReadonlySignal<boolean>;
  /** Хотя бы один ребёнок ждёт проверки. */
  pending: ReadonlySignal<boolean>;
  touched: ReadonlySignal<boolean>;
  dirty: ReadonlySignal<boolean>;
  /** Свои замечания и замечания всех детей. */
  issues: ReadonlySignal<readonly ValidationIssue[]>;
}

export interface AggregateSignalsOptions {
  /** Дети контейнера; чтение внутри `computed` подписывает на их состав. */
  getChildren: () => readonly FormNode<unknown>[];
  /** Замечания самого контейнера. */
  ownIssues: ReadonlySignal<readonly ValidationIssue[]>;
}

export function createAggregateSignals(options: AggregateSignalsOptions): AggregateSignals {
  const { getChildren, ownIssues } = options;
  // Отключённый ребёнок в валидность не входит.
  const valid = computed(
    () =>
      ownIssues.value.length === 0 &&
      getChildren().every((child) => child.disabled.value || child.valid.value)
  );
  return {
    valid,
    invalid: computed(() => !valid.value),
    pending: computed(() => getChildren().some((child) => child.pending.value)),
    touched: computed(() => getChildren().some((child) => child.touched.value)),
    dirty: computed(() => getChildren().some((child) => child.dirty.value)),
    issues: computed(() => [
      ...ownIssues.value,
      ...getChildren().flatMap((child) => child.issues.value),
    ]),
  };
}
