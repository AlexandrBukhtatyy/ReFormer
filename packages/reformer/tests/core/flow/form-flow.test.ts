/**
 * Поток шагов `FormFlow`: переходы, правила доступности шагов и проверка шага.
 *
 * Правила доступности перенесены из визарда cdk (`goToStep`, `pruneCompletedStepsOnBack`): теперь
 * их держит ядро, визард лишь рисует поток.
 */

import { describe, it, expect } from 'vitest';
import { createFormFlow } from '../../../src/form/flow/flow';
import type { ValidationResult, ValidationStatus } from '../../../src/form/validation/types';

const resultOf = (status: ValidationStatus): ValidationResult => ({
  status,
  issues: new Map(),
  failures: [],
});

const flowOf = (steps = ['loan', 'applicant', 'contacts']) => createFormFlow({ steps });

describe('createFormFlow — шаги', () => {
  it('начинает с первого шага', () => {
    const flow = flowOf();

    expect(flow.current.value).toBe('loan');
    expect(flow.index.value).toBe(0);
    expect(flow.isFirst.value).toBe(true);
    expect(flow.isLast.value).toBe(false);
    expect([...flow.completed.value]).toEqual([]);
  });

  it('без шагов и с повтором шага — исключение', () => {
    expect(() => createFormFlow({ steps: [] })).toThrow('у потока нет шагов');
    expect(() => createFormFlow({ steps: ['a', 'b', 'a'] })).toThrow('шаги повторяются: a');
  });
});

describe('createFormFlow — next', () => {
  it('без проверки переходит дальше и отмечает шаг пройденным', async () => {
    const flow = flowOf();

    expect(await flow.next()).toEqual({ status: 'moved', from: 'loan', to: 'applicant' });
    expect([...flow.completed.value]).toEqual(['loan']);
  });

  it('замечания шага держат поток на месте с результатом проверки', async () => {
    const invalid = resultOf('invalid');
    const flow = createFormFlow({
      steps: ['loan', 'applicant'],
      validateStep: async () => invalid,
    });

    expect(await flow.next()).toEqual({
      status: 'stayed',
      step: 'loan',
      reason: 'invalid',
      validation: invalid,
    });
    expect(flow.current.value).toBe('loan');
    expect([...flow.completed.value]).toEqual([]);
  });

  it('сбой и отмена проверки — свои причины', async () => {
    for (const status of ['error', 'cancelled'] as const) {
      const flow = createFormFlow({
        steps: ['a', 'b'],
        validateStep: async () => resultOf(status),
      });
      expect(await flow.next()).toMatchObject({ status: 'stayed', reason: status });
    }
  });

  it('проверяет правила текущего шага', async () => {
    const checked: string[] = [];
    const flow = createFormFlow({
      steps: ['loan', 'applicant', 'contacts'],
      validateStep: async (step) => {
        checked.push(step);
        return resultOf('valid');
      },
    });

    await flow.next();
    await flow.next();

    expect(checked).toEqual(['loan', 'applicant']);
  });

  it('на последнем шаге — край: шаг пройден, поток на месте', async () => {
    const flow = flowOf(['a', 'b']);
    await flow.next();

    expect(await flow.next()).toEqual({ status: 'stayed', step: 'b', reason: 'edge' });
    expect(flow.isLast.value).toBe(true);
    expect([...flow.completed.value]).toEqual(['a', 'b']);
  });

  it('validating — пока идёт проверка шага', async () => {
    let finish: (result: ValidationResult) => void = () => {};
    const flow = createFormFlow({
      steps: ['a', 'b'],
      validateStep: () => new Promise((resolve) => (finish = resolve)),
    });

    const pending = flow.next();
    expect(flow.validating.value).toBe(true);
    finish(resultOf('valid'));
    await pending;
    expect(flow.validating.value).toBe(false);
  });

  it('если за время проверки поток перевели — результат к прежнему шагу не применяется', async () => {
    let finish: (result: ValidationResult) => void = () => {};
    const flow = createFormFlow({
      steps: ['a', 'b', 'c'],
      validateStep: () => new Promise((resolve) => (finish = resolve)),
    });
    const pending = flow.next();
    flow.reset();
    finish(resultOf('valid'));

    expect(await pending).toMatchObject({ status: 'stayed', step: 'a', reason: 'cancelled' });
  });
});

describe('createFormFlow — доступность шагов (перенос из визарда cdk)', () => {
  it('первый шаг доступен всегда, следующий — после прохождения предыдущего', async () => {
    const flow = flowOf();

    expect(flow.canGoTo('loan')).toBe(true);
    expect(flow.canGoTo('applicant')).toBe(false);
    await flow.next();
    expect(flow.canGoTo('applicant')).toBe(true);
    expect(flow.canGoTo('contacts')).toBe(false);
  });

  it('недоступный шаг — поток на месте с причиной locked', () => {
    const flow = flowOf();

    expect(flow.goTo('contacts')).toEqual({ status: 'stayed', step: 'loan', reason: 'locked' });
  });

  it('неизвестный шаг: goTo — исключение, canGoTo — false', () => {
    const flow = flowOf();

    expect(() => flow.goTo('missing')).toThrow('шага «missing» нет');
    expect(flow.canGoTo('missing')).toBe(false);
  });

  it('возврат назад: пройденными остаются только шаги строго до цели', async () => {
    const flow = flowOf(['a', 'b', 'c', 'd']);
    await flow.next();
    await flow.next();
    await flow.next();

    expect(flow.goTo('b')).toEqual({ status: 'moved', from: 'd', to: 'b' });
    expect([...flow.completed.value]).toEqual(['a']);
    // Прыжок вперёд снова требует пройти шаг b.
    expect(flow.canGoTo('c')).toBe(false);
  });

  it('возврат на первый шаг очищает пройденные полностью', async () => {
    const flow = flowOf();
    await flow.next();
    await flow.next();

    flow.goTo('loan');

    expect([...flow.completed.value]).toEqual([]);
  });

  it('previous: шаг назад с той же обрезкой; на первом — край', async () => {
    const flow = flowOf();
    expect(flow.previous()).toEqual({ status: 'stayed', step: 'loan', reason: 'edge' });
    await flow.next();
    await flow.next();

    expect(flow.previous()).toEqual({ status: 'moved', from: 'contacts', to: 'applicant' });
    expect([...flow.completed.value]).toEqual(['loan']);
  });

  it('reset: первый шаг, пройденных нет', async () => {
    const flow = flowOf();
    await flow.next();

    flow.reset();

    expect(flow.current.value).toBe('loan');
    expect([...flow.completed.value]).toEqual([]);
  });
});
