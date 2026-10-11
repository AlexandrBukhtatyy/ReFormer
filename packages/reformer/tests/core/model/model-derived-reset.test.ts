/**
 * Производные поля в сбросе и в `isDirty` модели.
 *
 * Производное поле — цель `compute` / `computeFrom` либо поле с явным `markDerived` (им владеет
 * сервер). `set` и `patch` такие поля пропускают; здесь закреплено, что так же поступают
 * `model.reset()` и `model.isDirty()`. Причина: снимок модели снят при её создании — до первого
 * расчёта поведения, — а `compute` пересчитывает поле только при смене источников. Сброс, пишущий
 * снимок, оставлял бы поле «сырым», а сравнение со снимком делало бы изменённой форму без единой
 * правки [ReFormer-e9rw].
 *
 * Примитив `computeFrom` из `./model` цель не помечает — это делают операторы `./behaviors`. Тесты
 * слоя модели повторяют их вручную: `markDerived` рядом с расчётом и `unmarkDerived` при снятии.
 */

import { describe, expect, it } from 'vitest';
import {
  arrayOf,
  computeFrom,
  createModel,
  isDerived,
  markDerived,
  unmarkDerived,
} from '../../../src/model/index';

interface Loan {
  type: 'consumer' | 'mortgage';
  rate: number;
  amount: number;
}

/** Ставка зависит от вида кредита; в начальных значениях она — заглушка 0. */
function createLoan() {
  const model = createModel<Loan>({ type: 'consumer', rate: 0, amount: 0 });
  markDerived(model.$.rate);
  const stopCompute = computeFrom([model.$.type], model.$.rate, (type) =>
    type === 'consumer' ? 15.9 : 9.9
  );
  const stop = (): void => {
    stopCompute();
    unmarkDerived(model.$.rate);
  };
  return { model, stop };
}

describe('model — сброс и производные поля', () => {
  it('reset() не пишет в цель compute: поле остаётся согласованным с расчётом', () => {
    const { model } = createLoan();
    model.amount = 500_000;

    model.reset();

    // Было: 0 из снимка — источник (`type`) сброс не менял, и пересчитать ставку было нечему.
    expect({ rate: model.rate, amount: model.amount }).toEqual({ rate: 15.9, amount: 0 });
  });

  it('reset() возвращает источник — цель compute пересчитывается сама', () => {
    const { model } = createLoan();
    model.type = 'mortgage';
    const changed = model.rate;

    model.reset();

    expect({ changed, type: model.type, rate: model.rate }).toEqual({
      changed: 9.9,
      type: 'consumer',
      rate: 15.9,
    });
  });

  it('reset() не трогает поле с явным markDerived — им владеет сервер', () => {
    const model = createModel({ number: '', comment: '' });
    markDerived(model.$.number);
    model.$.number.value = 'ЗК-000042';
    model.comment = 'черновик';

    model.reset();

    expect(model.get()).toEqual({ number: 'ЗК-000042', comment: '' });
  });

  it('после unmarkDerived поле снова сбрасывается к снимку', () => {
    const { model, stop } = createLoan();
    stop();
    expect(isDerived(model.$.rate)).toBe(false);

    model.reset();

    expect(model.rate).toBe(0);
  });

  it('unmarkDerived возвращает сброс и полю сервера', () => {
    const model = createModel({ number: '' });
    markDerived(model.$.number);
    model.$.number.value = 'ЗК-000042';
    unmarkDerived(model.$.number);

    model.reset();

    expect(model.number).toBe('');
  });
});

describe('model — isDirty и производные поля', () => {
  it('модель без единой правки не изменена, хотя compute уже записал цель', () => {
    const { model } = createLoan();

    expect({ rate: model.rate, dirty: model.isDirty() }).toEqual({ rate: 15.9, dirty: false });
  });

  it('пересчёт цели после правки источника сам по себе изменением не считается', () => {
    const { model } = createLoan();
    model.type = 'mortgage';
    const whileChanged = model.isDirty();

    model.type = 'consumer';

    expect({ whileChanged, afterReturn: model.isDirty() }).toEqual({
      whileChanged: true,
      afterReturn: false,
    });
  });

  it('после reset() модель не изменена', () => {
    const { model } = createLoan();
    model.amount = 500_000;
    model.type = 'mortgage';

    model.reset();

    expect(model.isDirty()).toBe(false);
  });

  it('поле с явным markDerived в isDirty не входит', () => {
    const model = createModel({ number: '', comment: '' });
    markDerived(model.$.number);

    model.$.number.value = 'ЗК-000042';

    expect(model.isDirty()).toBe(false);
  });

  it('снятая пометка возвращает поле в сравнение', () => {
    const { model, stop } = createLoan();
    stop();

    // Значение ставки (15,9) осталось от расчёта и отличается от снимка (0).
    expect(model.isDirty()).toBe(true);
  });
});

describe('model — производные поля в строках массива', () => {
  interface Item {
    quantity: number;
    price: number;
    total: number;
  }
  interface Order {
    items: Item[];
  }

  /** Сумма строки считается из количества и цены — как поведение строки в `applyEach`. */
  function createOrder() {
    const model = createModel<Order>({
      items: arrayOf(
        (): Item => ({ quantity: 1, price: 0, total: 0 }),
        [{ quantity: 2, price: 100, total: 0 }]
      ),
    });
    const compute = (index: number): void => {
      const row = model.items.at(index)!;
      markDerived(row.$.total);
      computeFrom(
        [row.$.quantity, row.$.price],
        row.$.total,
        (quantity, price) => quantity * price
      );
    };
    compute(0);
    return { model, compute };
  }

  it('расчёт в строке не делает модель изменённой', () => {
    const { model } = createOrder();

    expect({ total: model.items.at(0)!.total, dirty: model.isDirty() }).toEqual({
      total: 200,
      dirty: false,
    });
  });

  it('правка поля строки и состав массива по-прежнему видны', () => {
    const { model, compute } = createOrder();

    model.items.at(0)!.quantity = 3;
    const edited = model.isDirty();
    model.items.at(0)!.quantity = 2;
    const restored = model.isDirty();
    model.items.push({ quantity: 1, price: 50, total: 0 });
    compute(1);

    expect({ edited, restored, pushed: model.isDirty() }).toEqual({
      edited: true,
      restored: false,
      pushed: true,
    });
  });

  it('captureInitial после загрузки: новая точка отсчёта — и снова не изменена', () => {
    const { model, compute } = createOrder();
    model.items.push({ quantity: 4, price: 25, total: 0 });
    compute(1);

    model.captureInitial();

    expect({ total: model.items.at(1)!.total, dirty: model.isDirty() }).toEqual({
      total: 100,
      dirty: false,
    });
  });
});

describe('model — isDirty: массив в листе и строка другого вида', () => {
  it('лист с массивом сравнивается со снимком поэлементно', () => {
    // Поле из начального `null` — лист: массив в нём — атомарное значение, а не строки под-форм.
    const model = createModel<{ files: string[] | null }>({ files: null });
    model.$.files.value = ['паспорт.pdf'];
    model.captureInitial();

    model.$.files.value = ['паспорт.pdf'];
    const sameContent = model.isDirty();
    model.$.files.value = ['паспорт.pdf', 'справка.pdf'];
    const longer = model.isDirty();
    model.$.files.value = ['договор.pdf'];

    expect({ sameContent, longer, otherItem: model.isDirty() }).toEqual({
      sameContent: false,
      longer: true,
      otherItem: true,
    });
  });

  it('строка-объект на месте пустого элемента снимка — изменение', () => {
    const model = createModel<{ rows: Array<{ label: string } | null> }>({ rows: [null] });

    model.set({ rows: [{ label: 'новая' }] });

    expect(model.isDirty()).toBe(true);
  });
});
