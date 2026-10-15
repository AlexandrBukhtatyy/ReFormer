/**
 * Снятие сборки — `bundle.dispose()` и `disposeForm(form)`.
 *
 * Сборка снимает поведение формы, живую проверку и идущие проверки: полную, шага и отправки.
 * Значения модели остаются. Форму из низкоуровневой фабрики снимает `disposeForm`.
 */

import { describe, it, expect, vi } from 'vitest';
import { tick } from '../../test-utils/async';
import { createForm } from '../../../src/form/form-bundle';
import { createFormFromModel, disposeForm } from '../../../src/form/create-form';
import { createModel } from '../../../src/model/index';
import { defineFormBehavior, onChange, onDispose } from '../../../src/form/behaviors';
import { defineValidation, validate } from '../../../src/form/validation';
import { controlledAmountRules, type Shape } from './shape-form.fixture';

const INITIAL: Shape = { amount: '1', phone: '' };

/** Поведение, которое отмечает каждую правку суммы и своё снятие. */
function watchedBehavior() {
  const changes = vi.fn();
  const cleanup = vi.fn();
  const behavior = defineFormBehavior<Shape>(({ model }) => {
    onChange(model.$.amount, changes);
    onDispose(cleanup);
  });
  return { behavior, changes, cleanup };
}

describe('bundle.dispose()', () => {
  it('снимает поведение: правки модели его больше не будят, значения остаются', async () => {
    const { behavior, changes, cleanup } = watchedBehavior();
    const bundle = createForm<Shape>({ initial: INITIAL, behavior });

    bundle.dispose();
    bundle.model.amount = '2';
    await tick();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(changes).not.toHaveBeenCalled();
    expect(bundle.model.amount).toBe('2');
  });

  it('снимает живую проверку: правка после снятия правила не запускает', async () => {
    const rule = vi.fn(() => null);
    const bundle = createForm<Shape>({
      initial: INITIAL,
      validation: {
        rules: defineValidation<Shape>(({ model }) => validate(model.$.amount, [rule])),
        strategy: 'change',
      },
    });
    bundle.validation!.controller.start();

    bundle.dispose();
    bundle.model.amount = '2';
    await tick();

    expect(rule).not.toHaveBeenCalled();
  });

  it('идущая проверка шага получает cancelled, замечание на поле не ложится', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({
      initial: INITIAL,
      flow: { steps: [{ id: 'loan', rules }, { id: 'confirm' }] },
    });

    const checking = bundle.validateStep('loan');
    bundle.dispose();
    answers[0].resolve({ code: 'taken' });

    expect((await checking).status).toBe('cancelled');
    expect(bundle.form.amount.issues.value).toEqual([]);
  });

  it('идущая проверка отправки получает cancelled, обработчик не вызывается', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({ initial: INITIAL, validation: rules });
    const handler = vi.fn();

    const sending = bundle.submission.submit(handler);
    bundle.dispose();
    answers[0].resolve(null);

    expect((await sending).status).toBe('cancelled');
    expect(handler).not.toHaveBeenCalled();
  });

  it('повторный вызов ничего не делает', () => {
    const { behavior, cleanup } = watchedBehavior();
    const bundle = createForm<Shape>({
      initial: INITIAL,
      behavior,
      validation: controlledAmountRules().rules,
    });

    bundle.dispose();
    expect(() => bundle.dispose()).not.toThrow();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('сбой setup снимает сборку: бандл вызывающему не достаётся', () => {
    const { behavior, cleanup } = watchedBehavior();

    expect(() =>
      createForm<Shape>({
        initial: INITIAL,
        behavior,
        setup: () => {
          throw new Error('setup');
        },
      })
    ).toThrow('setup');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('disposeForm(form)', () => {
  it('снимает форму из createFormFromModel: поведение больше не отвечает на правки', async () => {
    const { behavior, changes, cleanup } = watchedBehavior();
    const model = createModel<Shape>({ ...INITIAL });
    const form = createFormFromModel<Shape>({ model, behavior });

    disposeForm(form);
    model.amount = '2';
    await tick();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(changes).not.toHaveBeenCalled();
  });
});
