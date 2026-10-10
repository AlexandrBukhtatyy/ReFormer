/**
 * Уровень формы в бандле `createForm`: `validate`, `validateStep`, `submit` и поток шагов.
 *
 * Отправка — один прогон всех правил; результат — объект со статусом, по которому различают
 * замечания, сбой правила, отмену и исключение обработчика.
 */

import { describe, it, expect, vi } from 'vitest';
import { tick } from '../../test-utils/async';
import { createForm } from '../../../src/form/form-bundle';
import { defineFormBehavior, enableWhen } from '../../../src/form/behaviors';
import {
  defineValidation,
  validate,
  validateAsync,
  validateModel,
} from '../../../src/form/validation';
import { required } from '../../../src/form/validators';

interface Shape {
  amount: string;
  phone: string;
}

const loanRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.amount, [required()]);
});
const contactsRules = defineValidation<Shape>(({ model }) => {
  validate(model.$.phone, [required()]);
});

const createShape = (initial: Shape = { amount: '', phone: '' }) =>
  createForm<Shape>({
    initial,
    flow: {
      steps: [
        { id: 'loan', rules: loanRules },
        { id: 'contacts', rules: contactsRules },
        { id: 'confirm' },
      ],
    },
  });

describe('createForm — поток шагов', () => {
  it('поток из конфига: шаги по порядку, переход проверяет правила шага', async () => {
    const bundle = createShape();

    expect(bundle.flow?.steps).toEqual(['loan', 'contacts', 'confirm']);
    expect(await bundle.flow!.next()).toMatchObject({ status: 'stayed', reason: 'invalid' });
    expect(bundle.form.amount.issues.value).toEqual([{ code: 'required' }]);

    bundle.model.amount = '100';
    expect(await bundle.flow!.next()).toEqual({ status: 'moved', from: 'loan', to: 'contacts' });
  });

  it('без `flow` потока нет', () => {
    expect(createForm<Shape>({ initial: { amount: '', phone: '' } }).flow).toBeUndefined();
  });

  it('поведение получает поток', () => {
    const seen: unknown[] = [];
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '' },
      flow: { steps: [{ id: 'a' }, { id: 'b' }] },
      behavior: defineFormBehavior<Shape>(({ flow }) => {
        seen.push(flow);
      }),
    });

    expect(seen).toEqual([bundle.flow]);
  });

  it('повтор шага в потоке — исключение', () => {
    expect(() =>
      createForm<Shape>({
        initial: { amount: '', phone: '' },
        flow: { steps: [{ id: 'a' }, { id: 'a' }] },
      })
    ).toThrow('шаг потока «a» повторяется');
  });
});

describe('createForm — validate и validateStep', () => {
  it('validate прогоняет правила всех шагов и extras', async () => {
    const extras = defineValidation<Shape>(({ model, cross }) => {
      cross(model.$.phone, (shape) => (shape.phone === shape.amount ? { code: 'same' } : null));
    });
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '1' },
      flow: { steps: [{ id: 'loan', rules: loanRules }] },
      validation: { extras },
    });

    const result = await bundle.validate();

    expect(result.status).toBe('invalid');
    expect(bundle.form.phone.issues.value).toEqual([{ code: 'same' }]);
  });

  it('validate без правил — valid', async () => {
    const bundle = createForm<Shape>({ initial: { amount: '', phone: '' } });

    expect((await bundle.validate()).status).toBe('valid');
  });

  it('validateStep — правила одного шага; шаг без правил — valid', async () => {
    const bundle = createShape();

    expect((await bundle.validateStep('contacts')).status).toBe('invalid');
    expect(bundle.form.amount.issues.value).toEqual([]);
    expect((await bundle.validateStep('confirm')).status).toBe('valid');
  });

  it('неизвестный шаг — исключение', async () => {
    const bundle = createShape();

    await expect(bundle.validateStep('missing')).rejects.toThrow('шага «missing» нет в потоке');
  });

  it('validation.rules — полный набор вместо правил шагов', async () => {
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '' },
      flow: { steps: [{ id: 'loan', rules: loanRules }] },
      validation: { rules: contactsRules },
    });

    await bundle.validate();

    expect(bundle.form.phone.issues.value).toEqual([{ code: 'required' }]);
    expect(bundle.form.amount.issues.value).toEqual([]);
  });
});

describe('createForm — submit', () => {
  it('submitted: обработчик получает значения модели, результат — его ответ', async () => {
    const bundle = createShape({ amount: '100', phone: '+7' });
    const handler = vi.fn(async (values: Shape) => `заявка ${values.amount}`);

    const result = await bundle.submit(handler);

    expect(result).toEqual({ status: 'submitted', result: 'заявка 100' });
    expect(handler).toHaveBeenCalledWith({ amount: '100', phone: '+7' });
  });

  it('invalid: обработчик не вызывается, поля помечены тронутыми', async () => {
    const bundle = createShape();
    const handler = vi.fn();

    const result = await bundle.submit(handler);

    expect(result).toMatchObject({ status: 'invalid', validation: { status: 'invalid' } });
    expect(handler).not.toHaveBeenCalled();
    expect(bundle.form.amount.touched.value).toBe(true);
    expect(bundle.form.amount.shouldShowError.value).toBe(true);
  });

  it('error: правило не вернуло результат — обработчик не вызывается', async () => {
    const failing = defineValidation<Shape>(({ model }) => {
      validateAsync(model.$.amount, [() => Promise.reject(new Error('сеть'))]);
    });
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: failing });
    const handler = vi.fn();

    expect((await bundle.submit(handler)).status).toBe('error');
    expect(handler).not.toHaveBeenCalled();
  });

  it('failed: исключение обработчика — в результате, а не наружу', async () => {
    const bundle = createShape({ amount: '1', phone: '1' });
    const error = new Error('500');

    expect(
      await bundle.submit(() => {
        throw error;
      })
    ).toEqual({ status: 'failed', error });
    expect(bundle.submitting.value).toBe(false);
  });

  it('ровно один прогон правил на отправку', async () => {
    const rule = vi.fn(() => null);
    const counted = defineValidation<Shape>(({ model }) => {
      validate(model.$.amount, [rule]);
    });
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: counted });

    await bundle.submit(() => 'ok');

    expect(rule).toHaveBeenCalledTimes(1);
  });

  it('submitting — пока работает обработчик', async () => {
    const bundle = createShape({ amount: '1', phone: '1' });
    let during = false;

    await bundle.submit(() => {
      during = bundle.submitting.value;
    });

    expect(during).toBe(true);
    expect(bundle.submitting.value).toBe(false);
  });
});

describe('createForm — выключенные поля в проверке формы', () => {
  // `enableWhen` переключает доступность вне эффекта — на следующем микротаске: тесты ждут `tick()`.

  /** Телефон обязателен, но выключен поведением, пока сумма пуста. */
  const createWithDisabledPhone = (initial: Shape = { amount: '', phone: '' }) =>
    createForm<Shape>({
      initial,
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      validation: contactsRules,
    });

  it('submit: правило выключенного поля не делает форму invalid', async () => {
    const bundle = createWithDisabledPhone();
    const handler = vi.fn(() => 'ok');
    await tick();

    expect(bundle.form.phone.disabled.value).toBe(true);
    expect(await bundle.submit(handler)).toEqual({ status: 'submitted', result: 'ok' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(bundle.form.phone.issues.value).toEqual([]);
  });

  it('статус прогона совпадает с агрегатом valid формы', async () => {
    const bundle = createWithDisabledPhone();
    await tick();

    const result = await bundle.validate();

    expect(result.status).toBe('valid');
    expect(bundle.form.valid.value).toBe(true);
  });

  it('включённое снова поле проверяется', async () => {
    const bundle = createWithDisabledPhone();
    await tick();
    await bundle.validate();

    bundle.model.amount = '100';
    await tick();
    expect(bundle.form.phone.disabled.value).toBe(false);

    expect((await bundle.validate()).status).toBe('invalid');
    expect(bundle.form.phone.issues.value).toEqual([{ code: 'required' }]);
  });

  it('замечание, выставленное до выключения, гасится следующим прогоном', async () => {
    const bundle = createWithDisabledPhone({ amount: '100', phone: '' });
    await tick();
    expect((await bundle.validate()).status).toBe('invalid');

    bundle.model.amount = '';
    await tick();
    expect((await bundle.validate()).status).toBe('valid');
    expect(bundle.form.phone.issues.value).toEqual([]);
  });

  it('validateStep: выключенное поле шага не держит переход', async () => {
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '' },
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      flow: { steps: [{ id: 'contacts', rules: contactsRules }, { id: 'confirm' }] },
    });
    await tick();

    expect((await bundle.validateStep('contacts')).status).toBe('valid');
    expect(await bundle.flow!.next()).toEqual({ status: 'moved', from: 'contacts', to: 'confirm' });
  });

  it('сбой async-правила выключенного поля не даёт error', async () => {
    const failing = defineValidation<Shape>(({ model }) => {
      validateAsync(model.$.phone, [() => Promise.reject(new Error('сеть'))]);
    });
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '1' },
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      validation: failing,
    });
    await tick();

    expect((await bundle.validate()).status).toBe('valid');
  });

  it('независимый раннер validateModel доступность не учитывает', async () => {
    const bundle = createWithDisabledPhone();
    await tick();

    expect(await validateModel(bundle.model, contactsRules)).toBe(false);
  });
});
