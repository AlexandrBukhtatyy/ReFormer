/**
 * Агрегированные сигналы контейнера (группа, массив под-форм): состояние из детей и своих
 * замечаний.
 *
 * Семантика — как у поля: `warning` не блокирует; пока нода ждёт проверки, она ни `valid`, ни
 * `invalid`.
 *
 * @internal
 * @module form/aggregate-signals
 */

import { computed, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationIssue } from './types/contracts';
import type { FormNode } from './types/nodes';

export interface AggregateSignals {
  /** Блокирующих своих замечаний нет, никто не ждёт проверки, каждый включённый ребёнок валиден. */
  valid: ReadonlySignal<boolean>;
  /** Никто не ждёт проверки, и есть блокирующее своё замечание или включённый невалидный ребёнок. */
  invalid: ReadonlySignal<boolean>;
  /** Контейнер или хотя бы один ребёнок ждёт проверки. */
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
  /** Ожидание async-правила на ручке самого контейнера (`validateAsync(model.$.items, …)`). */
  ownPending?: ReadonlySignal<boolean>;
}

export function createAggregateSignals(options: AggregateSignalsOptions): AggregateSignals {
  const { getChildren, ownIssues, ownPending } = options;
  // `warning` отправку не блокирует — ни у поля, ни у контейнера.
  const ownBlocking = computed(() => ownIssues.value.some((issue) => issue.severity !== 'warning'));
  const pending = computed(
    () => (ownPending?.value ?? false) || getChildren().some((child) => child.pending.value)
  );
  // Отключённый ребёнок в валидность не входит.
  const valid = computed(
    () =>
      !pending.value &&
      !ownBlocking.value &&
      getChildren().every((child) => child.disabled.value || child.valid.value)
  );
  const invalid = computed(
    () =>
      !pending.value &&
      (ownBlocking.value ||
        getChildren().some((child) => !child.disabled.value && child.invalid.value))
  );
  return {
    valid,
    invalid,
    pending,
    touched: computed(() => getChildren().some((child) => child.touched.value)),
    dirty: computed(() => getChildren().some((child) => child.dirty.value)),
    issues: computed(() => [
      ...ownIssues.value,
      ...getChildren().flatMap((child) => child.issues.value),
    ]),
  };
}
