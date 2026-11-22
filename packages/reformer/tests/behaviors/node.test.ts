/**
 * `enableWhen` / `disableWhen` поля (`src/form/behaviors/node.ts`) — state-операции над нодой.
 *
 * Нода ищется по сигналу-цели через реестр сигнал→нода при каждом прогоне условия, запись
 * состояния отложена на микротаск. Ветви: нода есть (включить, выключить, сбросить при
 * выключении), ноды нет — ручка без поля в форме, нода появилась позже, снятие реакции.
 *
 * Операторы формы (`operators.ts`) берут отсюда `enableWhen`; `disableWhen` этого модуля сам
 * пакет не использует — у операторов формы своя инверсия.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { createModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import { disableWhen, enableWhen } from '../../src/form/behaviors/node';
import { tick } from '../test-utils/async';

interface Credit {
  kind: string;
  amount: number;
  locked: boolean;
}

const createCredit = () => createModel<Credit>({ kind: 'consumer', amount: 100, locked: false });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('node — enableWhen поля', () => {
  it('выключает и включает поле по условию; запись — на микротаске', async () => {
    const model = createCredit();
    const form = createFormFromModel<Credit>({ model });
    enableWhen(model.$.amount, () => model.kind === 'mortgage');
    const seen = [form.amount.disabled.value];

    await tick();
    seen.push(form.amount.disabled.value);
    model.kind = 'mortgage';
    seen.push(form.amount.disabled.value);
    await tick();
    seen.push(form.amount.disabled.value);

    expect(seen).toEqual([false, true, true, false]);
  });

  it('без resetOnDisable значение выключенного поля сохраняется', async () => {
    const model = createCredit();
    const form = createFormFromModel<Credit>({ model });
    enableWhen(model.$.amount, () => model.kind === 'consumer');
    model.amount = 700;

    model.kind = 'car';
    await tick();

    expect({ disabled: form.amount.disabled.value, amount: model.amount }).toEqual({
      disabled: true,
      amount: 700,
    });
  });

  it('resetOnDisable: выключение сбрасывает поле к начальному значению', async () => {
    const model = createCredit();
    const form = createFormFromModel<Credit>({ model });
    enableWhen(model.$.amount, () => model.kind === 'consumer', { resetOnDisable: true });
    model.amount = 700;

    model.kind = 'car';
    await tick();

    expect({ disabled: form.amount.disabled.value, amount: model.amount }).toEqual({
      disabled: true,
      amount: 100,
    });
  });

  it('ручка без поля в форме — ничего не делает и ничего не логирует', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const model = createCredit(); // формы над моделью нет — реестр пуст
    const detached = signal(0); // сигнал вне модели

    const stops = [
      enableWhen(model.$.amount, () => !model.locked, { resetOnDisable: true }),
      enableWhen(detached, () => false),
    ];
    model.amount = 555;
    model.locked = true; // будь нода — выключение со сбросом вернуло бы 100
    await tick();

    expect({ amount: model.amount, errors: error.mock.calls.length }).toEqual({
      amount: 555,
      errors: 0,
    });
    stops.forEach((stop) => stop());
  });

  it('нода, построенная позже, подхватывается при следующей смене условия', async () => {
    const model = createCredit();
    enableWhen(model.$.amount, () => !model.locked); // ноды ещё нет
    await tick();
    const form = createFormFromModel<Credit>({ model });
    const beforeChange = form.amount.disabled.value;

    model.locked = true;
    await tick();

    expect({ beforeChange, after: form.amount.disabled.value }).toEqual({
      beforeChange: false,
      after: true,
    });
  });

  it('cleanup снимает реакцию: следующие смены условия ноду не трогают', async () => {
    const model = createCredit();
    const form = createFormFromModel<Credit>({ model });
    const stop = enableWhen(model.$.amount, () => !model.locked);
    await tick();

    stop();
    model.locked = true;
    await tick();

    expect(form.amount.disabled.value).toBe(false);
  });
});

describe('node — disableWhen поля', () => {
  it('инверсия enableWhen: выключено, пока условие истинно', async () => {
    const model = createCredit();
    const form = createFormFromModel<Credit>({ model });
    disableWhen(model.$.amount, () => model.locked);
    await tick();
    const unlocked = form.amount.disabled.value;

    model.locked = true;
    await tick();

    expect([unlocked, form.amount.disabled.value]).toEqual([false, true]);
  });

  it('resetOnDisable доходит до enableWhen', async () => {
    const model = createCredit();
    createFormFromModel<Credit>({ model });
    disableWhen(model.$.amount, () => model.locked, { resetOnDisable: true });
    model.amount = 900;

    model.locked = true;
    await tick();

    expect(model.amount).toBe(100);
  });
});
