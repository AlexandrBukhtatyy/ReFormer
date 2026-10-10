/**
 * Поток шагов формы — `FormFlow`: текущий шаг, пройденные шаги и переходы между ними на сигналах,
 * без React.
 *
 * Поток знает только идентификаторы шагов и то, как проверить шаг; правила доступности шагов —
 * здесь, визард лишь рисует их состояние. Поток формы собирает `createForm({ flow })`, визард без
 * потока строит позиционный — без правил.
 *
 * @group Form
 * @module form/flow/flow
 */

import { batch, computed, signal, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationResult } from '../validation/types';

/**
 * Почему поток остался на шаге: `invalid` — у шага блокирующие замечания, `error` — правило не
 * вернуло результат, `cancelled` — прогон отменён, `edge` — дальше (или раньше) шагов нет,
 * `locked` — шаг недоступен, пока не пройден предыдущий.
 *
 * @group Form
 */
export type FlowStayReason = 'invalid' | 'error' | 'cancelled' | 'edge' | 'locked';

/**
 * Итог перехода: поток перешёл на другой шаг либо остался — с причиной и, если шаг проверялся,
 * результатом проверки.
 *
 * @group Form
 */
export type FlowTransition =
  | { readonly status: 'moved'; readonly from: string; readonly to: string }
  | {
      readonly status: 'stayed';
      readonly step: string;
      readonly reason: FlowStayReason;
      readonly validation?: ValidationResult;
    };

/**
 * Поток шагов формы.
 *
 * @group Form
 */
export interface FormFlow {
  /** Идентификаторы шагов по порядку. */
  readonly steps: readonly string[];
  /** Текущий шаг. */
  readonly current: ReadonlySignal<string>;
  /** Номер текущего шага с нуля. */
  readonly index: ReadonlySignal<number>;
  /** Пройденные шаги: правила шага прошли при переходе дальше. */
  readonly completed: ReadonlySignal<ReadonlySet<string>>;
  readonly isFirst: ReadonlySignal<boolean>;
  readonly isLast: ReadonlySignal<boolean>;
  /** Идёт ли проверка шага в `next()`. */
  readonly validating: ReadonlySignal<boolean>;
  /** Можно ли перейти на шаг: первый — всегда, остальные — после прохождения предыдущего. */
  canGoTo(stepId: string): boolean;
  /** Проверить правила текущего шага и при успехе перейти к следующему. */
  next(): Promise<FlowTransition>;
  /** Вернуться на шаг назад; пройденными остаются только шаги до него. */
  previous(): FlowTransition;
  /** Перейти на шаг; неизвестный шаг — исключение. */
  goTo(stepId: string): FlowTransition;
  /** Вернуться на первый шаг и забыть пройденные. */
  reset(): void;
}

/**
 * Опции {@link createFormFlow}.
 *
 * @group Form
 */
export interface FormFlowOptions {
  /** Идентификаторы шагов по порядку; не пустой список без повторов. */
  readonly steps: readonly string[];
  /** Проверка шага при `next()`; без неё шаг проходится без проверки. */
  readonly validateStep?: (stepId: string) => Promise<ValidationResult>;
}

const AT = '[@reformer/core] FormFlow';

/**
 * Создать поток шагов.
 *
 * @param options - {@link FormFlowOptions}: шаги и проверка шага.
 * @returns {@link FormFlow} на первом шаге.
 * @throws Error если шагов нет или идентификатор повторяется.
 *
 * @example
 * ```typescript
 * const flow = createFormFlow({ steps: ['loan', 'contacts', 'confirm'] });
 *
 * await flow.next(); // { status: 'moved', from: 'loan', to: 'contacts' }
 * flow.canGoTo('confirm'); // false — шаг contacts ещё не пройден
 * flow.goTo('loan'); // { status: 'moved', from: 'contacts', to: 'loan' }
 * ```
 *
 * @group Form
 */
export function createFormFlow(options: FormFlowOptions): FormFlow {
  const steps = [...options.steps];
  if (steps.length === 0) throw new Error(`${AT}: у потока нет шагов.`);
  const repeated = steps.filter((step, index) => steps.indexOf(step) !== index);
  if (repeated.length > 0) {
    throw new Error(`${AT}: шаги повторяются: ${[...new Set(repeated)].join(', ')}.`);
  }

  const index = signal(0);
  const completed = signal<ReadonlySet<string>>(new Set());
  const checks = signal(0);
  // Номер перехода: `next()` сверяет его после проверки шага — поток могли перевести или
  // сбросить, пока шла проверка, и тогда её результат относится к прежнему положению.
  let moves = 0;

  const indexOf = (stepId: string): number => steps.indexOf(stepId);
  const requireIndex = (stepId: string): number => {
    const at = indexOf(stepId);
    if (at < 0) {
      throw new Error(`${AT}: шага «${stepId}» нет. Шаги потока: ${steps.join(', ')}.`);
    }
    return at;
  };

  /** Перейти на шаг; назад — пройденными остаются только шаги до цели. */
  const moveTo = (target: number): FlowTransition => {
    const from = steps[index.peek()];
    moves++;
    batch(() => {
      if (target < index.peek()) {
        completed.value = new Set([...completed.peek()].filter((step) => indexOf(step) < target));
      }
      index.value = target;
    });
    return { status: 'moved', from, to: steps[target] };
  };

  const canGoTo = (stepId: string): boolean => {
    const at = indexOf(stepId);
    if (at < 0) return false;
    return at === 0 || completed.value.has(steps[at - 1]);
  };

  return {
    steps,
    current: computed(() => steps[index.value]),
    // Наружу — только чтение: шаг меняют переходы потока.
    index: computed(() => index.value),
    completed: computed(() => completed.value),
    isFirst: computed(() => index.value === 0),
    isLast: computed(() => index.value === steps.length - 1),
    validating: computed(() => checks.value > 0),
    canGoTo,

    async next() {
      const at = index.peek();
      const startedAt = moves;
      const step = steps[at];
      let validation: ValidationResult | undefined;
      if (options.validateStep) {
        checks.value++;
        try {
          validation = await options.validateStep(step);
        } finally {
          checks.value--;
        }
      }
      const checked = validation !== undefined ? { validation } : {};
      if (validation !== undefined && validation.status !== 'valid') {
        return { status: 'stayed', step, reason: validation.status, ...checked };
      }
      // Пока шёл прогон, поток перевели или сбросили: результат относится к прежнему положению.
      if (moves !== startedAt) {
        return { status: 'stayed', step: steps[index.peek()], reason: 'cancelled', ...checked };
      }
      completed.value = new Set([...completed.peek(), step]);
      if (at === steps.length - 1) return { status: 'stayed', step, reason: 'edge', ...checked };
      moves++;
      index.value = at + 1;
      return { status: 'moved', from: step, to: steps[at + 1] };
    },

    previous() {
      const at = index.peek();
      if (at === 0) return { status: 'stayed', step: steps[0], reason: 'edge' };
      return moveTo(at - 1);
    },

    goTo(stepId) {
      const target = requireIndex(stepId);
      if (!canGoTo(stepId)) {
        return { status: 'stayed', step: steps[index.peek()], reason: 'locked' };
      }
      return moveTo(target);
    },

    reset() {
      moves++;
      batch(() => {
        index.value = 0;
        completed.value = new Set();
      });
    },
  };
}
