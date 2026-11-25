/**
 * Поток шагов формы — `FormFlow`: текущий шаг, пройденные шаги и переходы между ними на сигналах,
 * без React.
 *
 * Поток знает только идентификаторы шагов, то, как проверить шаг, и участвует ли шаг сейчас
 * (`isActive`); правила доступности шагов — здесь, визард лишь рисует их состояние. Поток формы
 * собирает `createForm({ flow })`, визард без потока строит позиционный — без правил.
 *
 * Шаг, который сейчас не участвует (условный шаг: в сборке — скрытый узел шага), поток
 * пропускает: его нет в {@link FormFlow.activeSteps}, `next()` и `previous()` проходят мимо, а
 * `goTo` на него остаётся на месте.
 *
 * @group Form
 * @module form/flow/flow
 */

import { batch, computed, signal, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationResult } from '../validation/types';

/**
 * Почему поток остался на шаге: `invalid` — у шага блокирующие замечания, `error` — правило не
 * вернуло результат, `cancelled` — прогон отменён либо результат проверки устарел (поток перевели,
 * модель формы изменилась, пока шла проверка шага), `edge` — дальше (или раньше) шагов нет,
 * `locked` — шаг недоступен, пока не пройден предыдущий, `current` — `goTo` на шаг, на котором поток
 * уже стоит, `inactive` — `goTo` на шаг, который сейчас не участвует в потоке.
 *
 * @group Form
 */
export type FlowStayReason =
  | 'invalid'
  | 'error'
  | 'cancelled'
  | 'edge'
  | 'locked'
  | 'current'
  | 'inactive';

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
  /** Идентификаторы всех шагов по порядку — и тех, что сейчас не участвуют. */
  readonly steps: readonly string[];
  /**
   * Шаги, которые участвуют в потоке сейчас, по порядку: без условных шагов, чьё условие не
   * выполнено. По ним считаются `index`, `isFirst`, `isLast` и идут переходы; индикатор шагов
   * рисует их. Без `isActive` — все шаги. Список не бывает пустым: если не участвует ни один шаг,
   * в нём первый шаг потока.
   */
  readonly activeSteps: ReadonlySignal<readonly string[]>;
  /**
   * Текущий шаг — всегда участвующий. Если шаг, на котором стоял поток, перестал участвовать,
   * текущим становится ближайший участвующий шаг перед ним, а если такого нет — после него.
   */
  readonly current: ReadonlySignal<string>;
  /** Номер текущего шага с нуля — среди участвующих шагов ({@link FormFlow.activeSteps}). */
  readonly index: ReadonlySignal<number>;
  /** Пройденные шаги: правила шага прошли при переходе дальше. */
  readonly completed: ReadonlySignal<ReadonlySet<string>>;
  /** Текущий шаг — первый из участвующих. */
  readonly isFirst: ReadonlySignal<boolean>;
  /** Текущий шаг — последний из участвующих. */
  readonly isLast: ReadonlySignal<boolean>;
  /** Идёт ли проверка шага в `next()`. */
  readonly validating: ReadonlySignal<boolean>;
  /**
   * Можно ли перейти на шаг: первый участвующий — всегда, остальные — после прохождения
   * предыдущего участвующего; на шаг, который не участвует, — нельзя.
   */
  canGoTo(stepId: string): boolean;
  /** Проверить правила текущего шага и при успехе перейти к следующему участвующему. */
  next(): Promise<FlowTransition>;
  /** Вернуться на участвующий шаг назад; пройденными остаются только шаги до него. */
  previous(): FlowTransition;
  /** Перейти на шаг; неизвестный шаг — исключение, не участвующий — `inactive`. */
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
  /**
   * Участвует ли шаг в потоке сейчас — условный шаг. Функция реактивна: сигналы, прочитанные в
   * ней, пересчитывают {@link FormFlow.activeSteps}. Без неё участвуют все шаги.
   */
  readonly isActive?: (stepId: string) => boolean;
}

const AT = '[@reformer/core] FormFlow';

/**
 * Создать поток шагов.
 *
 * @param options - {@link FormFlowOptions}: шаги, проверка шага и условие участия шага.
 * @returns {@link FormFlow} на первом участвующем шаге.
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
 * @example Условный шаг: «Компания» участвует только у юрлица
 * ```typescript
 * const flow = createFormFlow({
 *   steps: ['buyer', 'company', 'delivery'],
 *   isActive: (step) => step !== 'company' || model.customerType === 'company',
 * });
 *
 * flow.activeSteps.value; // ['buyer', 'delivery'] — у физлица
 * await flow.next(); // { status: 'moved', from: 'buyer', to: 'delivery' }
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

  // Указатель потока — номер шага среди всех шагов. Текущий шаг — производный: шаг указателя
  // может перестать участвовать.
  const pointer = signal(0);
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

  const { isActive } = options;
  let lastActive: readonly string[] = steps;
  const activeSteps = computed<readonly string[]>(() => {
    if (!isActive) return steps;
    const active = steps.filter((step) => isActive(step));
    const next = active.length > 0 ? active : [steps[0]];
    // Тот же состав — та же ссылка: подписчики не перерисовываются впустую.
    const same =
      next.length === lastActive.length && next.every((step, at) => step === lastActive[at]);
    if (!same) lastActive = next;
    return lastActive;
  });

  /** Номер текущего шага среди всех шагов: шаг указателя либо ближайший к нему участвующий. */
  const currentAt = computed(() => {
    const active = activeSteps.value;
    const at = pointer.value;
    if (active.includes(steps[at])) return at;
    const before = active.filter((step) => indexOf(step) < at);
    return indexOf(before.length > 0 ? before[before.length - 1] : active[0]);
  });
  const index = computed(() => activeSteps.value.indexOf(steps[currentAt.value]));

  /** Перейти на шаг; назад — пройденными остаются только шаги до цели. */
  const moveTo = (target: number): FlowTransition => {
    const from = currentAt.peek();
    moves++;
    batch(() => {
      if (target < from) {
        completed.value = new Set([...completed.peek()].filter((step) => indexOf(step) < target));
      }
      pointer.value = target;
    });
    return { status: 'moved', from: steps[from], to: steps[target] };
  };

  const canGoTo = (stepId: string): boolean => {
    const active = activeSteps.value;
    const at = active.indexOf(stepId);
    if (at < 0) return false;
    return at === 0 || completed.value.has(active[at - 1]);
  };

  return {
    steps,
    activeSteps,
    current: computed(() => steps[currentAt.value]),
    // Наружу — только чтение: шаг меняют переходы потока.
    index,
    completed: computed(() => completed.value),
    isFirst: computed(() => index.value === 0),
    isLast: computed(() => index.value === activeSteps.value.length - 1),
    validating: computed(() => checks.value > 0),
    canGoTo,

    async next() {
      const startedAt = moves;
      const step = steps[currentAt.peek()];
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
      // Пока шёл прогон, поток перевели или сбросили либо шаг перестал участвовать: результат —
      // любой, и успех, и отказ — относится к прежнему положению, и шаг в ответе — тот, где поток
      // стоит сейчас.
      const now = steps[currentAt.peek()];
      if (moves !== startedAt || now !== step) {
        return { status: 'stayed', step: now, reason: 'cancelled', ...checked };
      }
      if (validation !== undefined && validation.status !== 'valid') {
        return { status: 'stayed', step, reason: validation.status, ...checked };
      }
      completed.value = new Set([...completed.peek(), step]);
      const active = activeSteps.peek();
      const following = active[active.indexOf(step) + 1];
      if (following === undefined) return { status: 'stayed', step, reason: 'edge', ...checked };
      moves++;
      pointer.value = indexOf(following);
      return { status: 'moved', from: step, to: following };
    },

    previous() {
      const active = activeSteps.peek();
      const step = steps[currentAt.peek()];
      const at = active.indexOf(step);
      if (at <= 0) return { status: 'stayed', step, reason: 'edge' };
      return moveTo(indexOf(active[at - 1]));
    },

    goTo(stepId) {
      const target = requireIndex(stepId);
      const step = steps[currentAt.peek()];
      // «На себя» — не переход: ничего не меняется, и ждущий `next()` не отменяется.
      if (stepId === step) return { status: 'stayed', step, reason: 'current' };
      if (!activeSteps.peek().includes(stepId)) {
        return { status: 'stayed', step, reason: 'inactive' };
      }
      if (!canGoTo(stepId)) return { status: 'stayed', step, reason: 'locked' };
      return moveTo(target);
    },

    reset() {
      moves++;
      batch(() => {
        pointer.value = 0;
        completed.value = new Set();
      });
    },
  };
}
