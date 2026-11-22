/**
 * Поток шагов под случайными последовательностями переходов (fast-check).
 *
 * Команды: `next()` с исходом проверки шага (`valid`, `invalid`, `error`, `cancelled`),
 * `previous()`, `goTo(шаг)` (в том числе неизвестный — исключение) и `reset()`. Эталон — номер
 * шага и множество пройденных; после каждой команды сверяются инварианты:
 * - `0 ≤ index < steps.length`, `current`, `isFirst`, `isLast` согласованы с номером;
 * - `completed` — подмножество шагов и ровно префикс до текущего (плюс последний шаг после края);
 * - `canGoTo(шаг)` ⇔ шаг первый или предыдущий пройден, и `goTo` переходит ровно тогда — кроме шага,
 *   где поток уже стоит: это не переход (`stayed`, `current`);
 * - запертый шаг не открывается: `goTo` на него оставляет номер и пройденные как были.
 *
 * Воспроизведение: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run form-flow.property`.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { propertyParams } from '../../test-utils/property';
import { createFormFlow, type FormFlow } from '../../../src/form/flow/flow';
import type { ValidationResult, ValidationStatus } from '../../../src/form/validation/types';

type Command =
  | { readonly kind: 'next'; readonly outcome: ValidationStatus }
  | { readonly kind: 'previous' }
  | { readonly kind: 'goTo'; readonly target: number }
  | { readonly kind: 'reset' };

/** Эталон потока: номер шага и пройденные шаги. */
interface Reference {
  index: number;
  completed: Set<string>;
}

const resultOf = (status: ValidationStatus): ValidationResult => ({
  status,
  issues: new Map(),
  failures: [],
});

/** Поток с проверкой шага, исход которой задаёт команда `next`. */
function flowWithOutcomes(steps: readonly string[]) {
  let outcome: ValidationStatus = 'valid';
  const flow = createFormFlow({ steps, validateStep: async () => resultOf(outcome) });
  return {
    flow,
    setOutcome: (next: ValidationStatus) => {
      outcome = next;
    },
  };
}

function verify(flow: FormFlow, steps: readonly string[], reference: Reference): void {
  const index = flow.index.value;
  const completed = [...flow.completed.value];

  expect(index).toBeGreaterThanOrEqual(0);
  expect(index).toBeLessThan(steps.length);
  expect(index).toBe(reference.index);
  expect(flow.current.value).toBe(steps[index]);
  expect(flow.isFirst.value).toBe(index === 0);
  expect(flow.isLast.value).toBe(index === steps.length - 1);

  expect(completed.every((step) => steps.includes(step))).toBe(true);
  expect(new Set(completed)).toEqual(reference.completed);
  // Пройденные — префикс: до текущего шага, а после края — вместе с последним.
  const prefix = steps.slice(0, completed.length);
  expect(completed.slice().sort()).toEqual(prefix.slice().sort());
  const edge = index === steps.length - 1 && completed.length === steps.length;
  expect(completed.length === index || edge).toBe(true);

  steps.forEach((step, at) => {
    expect(flow.canGoTo(step)).toBe(at === 0 || reference.completed.has(steps[at - 1]));
  });
}

async function run(
  command: Command,
  steps: readonly string[],
  subject: ReturnType<typeof flowWithOutcomes>,
  reference: Reference
): Promise<void> {
  const { flow } = subject;
  const step = steps[reference.index];

  if (command.kind === 'next') {
    subject.setOutcome(command.outcome);
    const transition = await flow.next();
    if (command.outcome !== 'valid') {
      expect(transition).toMatchObject({ status: 'stayed', step, reason: command.outcome });
      return;
    }
    reference.completed.add(step);
    if (reference.index === steps.length - 1) {
      expect(transition).toMatchObject({ status: 'stayed', step, reason: 'edge' });
      return;
    }
    reference.index += 1;
    expect(transition).toEqual({ status: 'moved', from: step, to: steps[reference.index] });
    return;
  }

  if (command.kind === 'previous') {
    const transition = flow.previous();
    if (reference.index === 0) {
      expect(transition).toEqual({ status: 'stayed', step, reason: 'edge' });
      return;
    }
    reference.index -= 1;
    reference.completed = new Set(steps.slice(0, reference.index));
    expect(transition).toEqual({ status: 'moved', from: step, to: steps[reference.index] });
    return;
  }

  if (command.kind === 'reset') {
    flow.reset();
    reference.index = 0;
    reference.completed = new Set();
    return;
  }

  // goTo: номер за концом списка — неизвестный шаг.
  if (command.target >= steps.length) {
    expect(() => flow.goTo('нет-такого-шага')).toThrow('шага «нет-такого-шага» нет');
    return;
  }
  const target = steps[command.target];
  const open = flow.canGoTo(target);
  const transition = flow.goTo(target);
  if (command.target === reference.index) {
    // «На себя» — не переход: номер и пройденные — как были.
    expect(transition).toEqual({ status: 'stayed', step, reason: 'current' });
    return;
  }
  if (!open) {
    // Запертый шаг не открывается: номер и пройденные — как были.
    expect(transition).toEqual({ status: 'stayed', step, reason: 'locked' });
    return;
  }
  expect(transition).toEqual({ status: 'moved', from: step, to: target });
  if (command.target < reference.index) {
    reference.completed = new Set(
      [...reference.completed].filter((done) => steps.indexOf(done) < command.target)
    );
  }
  reference.index = command.target;
}

const stepsArb = fc
  .integer({ min: 1, max: 6 })
  .map((count) => Array.from({ length: count }, (_, at) => `шаг-${at}`));
const commandArb: fc.Arbitrary<Command> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('next' as const),
      outcome: fc.constantFrom<ValidationStatus>('valid', 'valid', 'invalid', 'error', 'cancelled'),
    }),
  },
  { weight: 2, arbitrary: fc.constant({ kind: 'previous' as const }) },
  {
    weight: 3,
    arbitrary: fc.record({ kind: fc.constant('goTo' as const), target: fc.nat(6) }),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'reset' as const }) }
);

describe('createFormFlow — инварианты под случайными переходами', () => {
  it('индекс в границах, completed — префикс шагов, canGoTo согласован с goTo, запертое не открывается', async () => {
    await fc.assert(
      fc.asyncProperty(
        stepsArb,
        fc.array(commandArb, { maxLength: 30 }),
        async (steps, commands) => {
          const subject = flowWithOutcomes(steps);
          const reference: Reference = { index: 0, completed: new Set() };
          verify(subject.flow, steps, reference);

          for (const command of commands) {
            await run(command, steps, subject, reference);
            verify(subject.flow, steps, reference);
          }
        }
      ),
      propertyParams()
    );
  });

  it('из любого состояния reset возвращает поток в начало', async () => {
    await fc.assert(
      fc.asyncProperty(
        stepsArb,
        fc.array(commandArb, { maxLength: 20 }),
        async (steps, commands) => {
          const subject = flowWithOutcomes(steps);
          const reference: Reference = { index: 0, completed: new Set() };
          for (const command of commands) await run(command, steps, subject, reference);

          subject.flow.reset();

          expect(subject.flow.index.value).toBe(0);
          expect(subject.flow.completed.value.size).toBe(0);
          expect(steps.filter((step) => subject.flow.canGoTo(step))).toEqual([steps[0]]);
        }
      ),
      propertyParams()
    );
  });
});
