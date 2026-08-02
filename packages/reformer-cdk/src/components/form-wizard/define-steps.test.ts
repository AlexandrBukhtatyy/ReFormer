import { describe, it, expect } from 'vitest';
import { createModel } from '@reformer/core';
import { validate, defineValidationSchema, type ValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { defineSteps } from './define-steps';

interface F {
  a: string;
  b: string;
  c: string;
}

const makeModel = (v: Partial<F> = {}) => createModel<F>({ a: '', b: '', c: '', ...v });

const stepA: ValidationSchema<F> = ({ model }) => validate(model.$.a, [required({ message: 'a' })]);
const stepB: ValidationSchema<F> = ({ model }) => validate(model.$.b, [required({ message: 'b' })]);

describe('defineSteps', () => {
  it('stepSelectors — в порядке ключей', () => {
    const cfg = defineSteps<'first' | 'second' | 'third', F>(makeModel(), {
      steps: { first: stepA, second: stepB, third: null },
    });
    expect(cfg.stepSelectors).toEqual(['first', 'second', 'third']);
  });

  it('validateStep(n) прогоняет правила ИМЕННО n-го селектора (маппинг индекс→selector)', async () => {
    const model = makeModel({ a: '', b: 'ok' });
    const cfg = defineSteps<'first' | 'second', F>(model, {
      steps: { first: stepA, second: stepB },
    });
    expect(await cfg.validateStep(1)).toBe(false); // first → 'a' пустой
    expect(await cfg.validateStep(2)).toBe(true); // second → 'b' заполнен
  });

  it('шаг без правил (null) валиден', async () => {
    const cfg = defineSteps<'first' | 'confirm', F>(makeModel(), {
      steps: { first: stepA, confirm: null },
    });
    expect(await cfg.validateStep(2)).toBe(true); // confirm — правил нет
  });

  it('validateAll прогоняет все шаги + extras', async () => {
    const extras = defineValidationSchema<F>(({ model }) =>
      validate(model.$.c, [required({ message: 'c' })])
    );
    const bad = defineSteps<'first' | 'second', F>(makeModel({ a: 'x', b: 'y', c: '' }), {
      steps: { first: stepA, second: stepB },
      extras,
    });
    expect(await bad.validateAll()).toBe(false); // extras: 'c' пустой

    const good = defineSteps<'first' | 'second', F>(makeModel({ a: 'x', b: 'y', c: 'z' }), {
      steps: { first: stepA, second: stepB },
      extras,
    });
    expect(await good.validateAll()).toBe(true);
  });

  describe('createStepController (live-стратегия шага)', () => {
    it('без strategy (или submit) — контроллер не создаётся (null)', () => {
      const cfg = defineSteps<'first' | 'second', F>(makeModel(), {
        steps: { first: stepA, second: stepB },
      });
      expect(cfg.createStepController(1)).toBeNull();

      const cfgSubmit = defineSteps<'first' | 'second', F>(makeModel(), {
        steps: { first: stepA, second: stepB },
        strategy: 'submit',
      });
      expect(cfgSubmit.createStepController(1)).toBeNull();
    });

    it('со strategy — контроллер для шага с правилами; null для шага без правил', () => {
      const cfg = defineSteps<'first' | 'confirm', F>(makeModel(), {
        steps: { first: stepA, confirm: null },
        strategy: 'change',
      });
      const ctrl = cfg.createStepController(1);
      expect(ctrl).not.toBeNull();
      expect(cfg.createStepController(2)).toBeNull(); // confirm — правил нет
      ctrl?.dispose();
    });

    it('контроллер шага привязан к под-схеме ИМЕННО этого шага', async () => {
      const cfg = defineSteps<'first' | 'second', F>(makeModel({ a: '', b: 'ok' }), {
        steps: { first: stepA, second: stepB },
        strategy: 'change',
      });
      const first = cfg.createStepController(1);
      const second = cfg.createStepController(2);
      expect(await first?.validate()).toBe(false); // step1 → 'a' пустой
      expect(await second?.validate()).toBe(true); // step2 → 'b' заполнен
      first?.dispose();
      second?.dispose();
    });
  });
});
