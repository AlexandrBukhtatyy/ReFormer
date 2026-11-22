/**
 * Логика визарда кита — на настоящем потоке шагов ядра (`createFormFlow`, `createForm({ flow })`):
 * порядок шагов по `selector`, сверка схемы с потоком и то, как кнопки HexaUI `Wizard` ложатся на
 * поток. Главное — «Далее» всегда отвечает HexaUI `false`: шаг переводит поток, а не HexaUI.
 */

import { describe, expect, it, vi } from 'vitest';
import { createForm, createFormFlow } from '@reformer/core';
import { defineValidation, validate, type ValidationResult } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import {
  advance,
  clampStep,
  flowStepsMismatch,
  goToIndex,
  mismatchMessage,
  orderedNodes,
  positionalSteps,
  type WizardStepNode,
} from './wizard-steps';

/** Итог проверки шага без замечаний либо с отказом. */
const result = (status: 'valid' | 'invalid'): ValidationResult => ({
  status,
  issues: new Map(),
  failures: [],
});

const loan: WizardStepNode = { selector: 'loan', props: { title: 'Кредит' } };
const contacts: WizardStepNode = { selector: 'contacts', props: { title: 'Контакты' } };
const confirm: WizardStepNode = { selector: 'confirm', props: { title: 'Подтверждение' } };

describe('шаг схемы ↔ шаг потока', () => {
  it('узлы — в порядке потока, связь по selector', () => {
    expect(orderedNodes([confirm, loan, contacts], ['loan', 'contacts', 'confirm'])).toEqual([
      loan,
      contacts,
      confirm,
    ]);
  });

  it('шагу потока не нашлось узла — порядок узлов как есть', () => {
    const nodes = [contacts, loan];

    expect(orderedNodes(nodes, ['loan', 'contacts', 'confirm'])).toBe(nodes);
    expect(orderedNodes(nodes, ['loan'])).toBe(nodes);
  });

  it('без потока сборки (позиционный) порядок задаёт схема', () => {
    const nodes = [contacts, loan];

    expect(orderedNodes(nodes, undefined)).toBe(nodes);
  });

  it('расхождение — в обе стороны; совпадение — null', () => {
    expect(flowStepsMismatch(['loan', 'contacts'], ['loan', 'contacts'])).toBeNull();
    const mismatch = flowStepsMismatch(['loan', 'contacts'], ['loan', 'contact', undefined]);

    expect(mismatch).toEqual({ withoutNode: ['contacts'], withoutFlowStep: ['contact'] });
    expect(mismatchMessage(mismatch!)).toMatch(/"contacts".*"contact"/s);
  });

  it('позиционный поток: шаги по номерам, хотя бы один', () => {
    expect(positionalSteps(3)).toEqual(['1', '2', '3']);
    expect(positionalSteps(0)).toEqual(['1']);
    expect(() => createFormFlow({ steps: positionalSteps(0) })).not.toThrow();
  });

  it('номер шага для HexaUI не выходит за отрисованные шаги', () => {
    expect(clampStep(5, 3)).toBe(2);
    expect(clampStep(-1, 3)).toBe(0);
    expect(clampStep(1, 0)).toBe(0);
  });
});

describe('«Далее» HexaUI → поток', () => {
  it('шаг не прошёл проверку — поток стоит, HexaUI получает false', async () => {
    const flow = createFormFlow({
      steps: ['loan', 'contacts'],
      validateStep: async () => result('invalid'),
    });
    const submit = vi.fn(async () => undefined);

    await expect(advance(flow, submit)).resolves.toBe(false);
    expect(flow.current.value).toBe('loan');
    expect(submit).not.toHaveBeenCalled();
  });

  it('шаг прошёл — поток переходит сам, а HexaUI всё равно получает false (иначе двойной шаг)', async () => {
    const flow = createFormFlow({
      steps: ['loan', 'contacts', 'confirm'],
      validateStep: async () => result('valid'),
    });

    await expect(advance(flow, vi.fn())).resolves.toBe(false);
    expect(flow.index.value).toBe(1);
  });

  it('на последнем шаге — отправка вместо перехода', async () => {
    const flow = createFormFlow({ steps: ['loan', 'confirm'] });
    await flow.next();
    const submit = vi.fn(async () => undefined);

    await expect(advance(flow, submit)).resolves.toBe(false);
    expect(submit).toHaveBeenCalledOnce();
    expect(flow.current.value).toBe('confirm');
  });
});

describe('«Назад» и щелчок по шагу HexaUI → goTo потока', () => {
  it('назад — переход; вперёд на непройденный шаг поток не пускает', async () => {
    const flow = createFormFlow({ steps: ['loan', 'contacts', 'confirm'] });
    await flow.next();

    expect(goToIndex(flow, 2)).toMatchObject({ status: 'stayed', reason: 'locked' });
    expect(goToIndex(flow, 0)).toMatchObject({ status: 'moved', to: 'loan' });
    expect(flow.index.value).toBe(0);
  });

  it('шага с таким номером нет — null', () => {
    expect(goToIndex(createFormFlow({ steps: ['loan'] }), 3)).toBeNull();
  });
});

describe('сборка createForm({ flow }) — правила шага и отправка', () => {
  interface Shape {
    amount: string;
    phone: string;
  }

  const createBundle = () =>
    createForm<Shape>({
      initial: { amount: '', phone: '' },
      flow: {
        steps: [
          {
            id: 'loan',
            rules: defineValidation<Shape>(({ model }) => {
              validate(model.$.amount, [required()]);
            }),
          },
          {
            id: 'contacts',
            rules: defineValidation<Shape>(({ model }) => {
              validate(model.$.phone, [required()]);
            }),
          },
        ],
      },
    });

  it('пустое обязательное поле не пускает дальше; заполненное — пускает', async () => {
    const bundle = createBundle();
    const submit = () => bundle.submission.submit(() => undefined);

    await advance(bundle.flow!, submit);
    expect(bundle.flow!.current.value).toBe('loan');

    bundle.form.amount.setValue('100000');
    await advance(bundle.flow!, submit);
    expect(bundle.flow!.current.value).toBe('contacts');
    bundle.dispose();
  });

  it('на последнем шаге onSubmit получает значения — только после проверки всей формы', async () => {
    const bundle = createBundle();
    const onSubmit = vi.fn();
    const submit = () => bundle.submission.submit(onSubmit);
    bundle.form.amount.setValue('100000');
    await advance(bundle.flow!, submit);

    await advance(bundle.flow!, submit);
    expect(onSubmit).not.toHaveBeenCalled();

    bundle.form.phone.setValue('+7 900 000-00-00');
    await advance(bundle.flow!, submit);
    expect(onSubmit).toHaveBeenCalledWith({ amount: '100000', phone: '+7 900 000-00-00' });
    bundle.dispose();
  });
});
