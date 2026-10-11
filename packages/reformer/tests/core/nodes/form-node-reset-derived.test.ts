/**
 * Сброс нод формы и производные поля.
 *
 * Значение, к которому нода возвращается без аргумента, снято при её построении — до запуска
 * поведения. У цели `compute` это «сырое» значение из начальных данных, а `compute` пересчитывает
 * поле только при смене источников. Поэтому `reset()` ноды и группы цель `compute` не пишет — как
 * `setValue` группы и `model.reset()`; состояние (замечания, `touched`, `dirty`) сбрасывается как
 * обычно. Явное значение (`reset(значение)` у самого поля) — код приложения, оно пишется.
 *
 * Отдельно — `resetOnDisable`: выключенное поле обязано вернуться к значению создания, даже если оно
 * цель `compute` (её `compute` несёт то же условие `when`), иначе прежний расчёт ушёл бы в отправку.
 * [ReFormer-e9rw]
 */

import { describe, expect, it } from 'vitest';
import { settle } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';
import { createForm } from '../../../src/form/form-bundle';
import { compute, computeFrom, defineFormBehavior, enableWhen } from '../../../src/form/behaviors';

interface Loan {
  type: 'consumer' | 'mortgage';
  /** Ставка — цель `computeFrom`; в начальных значениях заглушка 0. */
  rate: number;
  amount: number;
  pledge: number | null;
  /** Взнос — цель `compute` с `when` и поле под `resetOnDisable`. */
  payment: number | null;
}

const INITIAL: Loan = { type: 'consumer', rate: 0, amount: 0, pledge: null, payment: null };

function createLoan(initial: Loan = INITIAL) {
  return createForm<Loan>({
    initial,
    behavior: defineFormBehavior<Loan>(({ model }) => {
      computeFrom([model.$.type], model.$.rate, (type) => (type === 'consumer' ? 15.9 : 9.9));
      const isMortgage = (): boolean => model.type === 'mortgage';
      enableWhen(model.$.payment, isMortgage, { resetOnDisable: true });
      compute(model.$.payment, () => (model.pledge ?? 0) * 0.2, { when: isMortgage });
    }),
  });
}

describe('reset нод — цель compute', () => {
  it('form.reset() не пишет в цель compute: ставка остаётся согласованной с расчётом', async () => {
    const { model, form } = createLoan();
    await settle();
    form.amount.setValue(500_000);

    form.reset();
    await settle();

    // Было: 0 — значение создания ноды; источник (`type`) сброс не менял, пересчитать было нечему.
    expect({ rate: model.rate, amount: model.amount }).toEqual({ rate: 15.9, amount: 0 });
  });

  it('form.reset() возвращает источник — цель пересчитывается сама', async () => {
    const { model, form } = createLoan();
    await settle();
    form.type.setValue('mortgage');
    const changed = model.rate;

    form.reset();
    await settle();

    expect({ changed, type: model.type, rate: model.rate }).toEqual({
      changed: 9.9,
      type: 'consumer',
      rate: 15.9,
    });
  });

  it('reset() самого поля: значение не трогает, состояние сбрасывает', async () => {
    const { model, form } = createLoan();
    await settle();
    form.rate.markAsTouched();
    form.rate.setIssues([{ code: 'rate.stale' }]);

    form.rate.reset();

    expect({
      rate: model.rate,
      touched: form.rate.touched.value,
      dirty: form.rate.dirty.value,
      issues: issueCodes(form.rate),
    }).toEqual({ rate: 15.9, touched: false, dirty: false, issues: [] });
  });

  it('reset(значение) самого поля — явный код: значение пишется', async () => {
    const { model, form } = createLoan();
    await settle();

    form.rate.reset(7);

    expect(model.rate).toBe(7);
  });

  it('form.reset(значения): обычные поля получают значения, цель compute — нет', async () => {
    const { model, form } = createLoan();
    await settle();

    form.reset({ ...INITIAL, amount: 300_000, rate: 1 });
    await settle();

    expect({ amount: model.amount, rate: model.rate }).toEqual({ amount: 300_000, rate: 15.9 });
  });
});

describe('resetOnDisable — цель compute', () => {
  it('выключенное поле возвращается к значению создания, хотя оно цель compute', async () => {
    const { model, form } = createLoan({ ...INITIAL, type: 'mortgage', pledge: 1_000_000 });
    await settle();
    const computed = model.payment;

    model.type = 'consumer';
    await settle();

    expect({ computed, disabled: form.payment.disabled.value, payment: model.payment }).toEqual({
      computed: 200_000,
      disabled: true,
      payment: null,
    });
  });

  it('снова включённое поле считается заново', async () => {
    const { model, form } = createLoan({ ...INITIAL, type: 'mortgage', pledge: 1_000_000 });
    await settle();
    model.type = 'consumer';
    await settle();

    model.pledge = 2_000_000;
    model.type = 'mortgage';
    await settle();

    expect({ disabled: form.payment.disabled.value, payment: model.payment }).toEqual({
      disabled: false,
      payment: 400_000,
    });
  });
});

describe('resetOnDisable — массив под-форм', () => {
  interface Order {
    delivery: boolean;
    parcels: Array<{ weight: number }>;
  }

  it('выключенный массив возвращается к строкам создания', async () => {
    const { model, form } = createForm<Order>({
      initial: { delivery: true, parcels: [{ weight: 1 }] },
      schema: (order) => ({
        children: [
          { model: order.$.delivery },
          { model: order.$.parcels, item: (parcel) => ({ model: parcel.$.weight }) },
        ],
      }),
      behavior: defineFormBehavior<Order>(({ model: order }) => {
        enableWhen(order.$.parcels, () => order.delivery, { resetOnDisable: true });
      }),
    });
    await settle();
    model.parcels.push({ weight: 5 });
    model.parcels.at(0)!.weight = 3;

    model.delivery = false;
    await settle();

    expect({ disabled: form.parcels.disabled.value, parcels: model.get().parcels }).toEqual({
      disabled: true,
      parcels: [{ weight: 1 }],
    });
  });
});
