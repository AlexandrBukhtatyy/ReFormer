/**
 * Операторы поведения над полем и группой (`src/form/behaviors/operators.ts`).
 *
 * Операторы — тонкие обёртки над value-операциями модели; ветви самих value-операций покрыты в
 * `tests/core/model/behaviors-value-dispose.test.ts`. Здесь — то, что добавляет слой формы:
 * отписка в сток схемы (снятие поведения останавливает реакцию), выбор ветки «лист / массив
 * целиком / группа», `when` у `compute` и `computeFrom`, признак derived и его снятие, guard
 * циклов, `onChange` с `immediate`, `debounce` и `AbortSignal`, `enableWhen`/`disableWhen` над
 * полем, группой и массивом — с нодой и без неё, и поведение операторов вне схемы.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal, type Signal } from '@preact/signals-core';
import { createModel, type FormModel } from '../../src/model/index';
import { isDerived } from '../../src/model/derived-registry';
import { createFormFromModel } from '../../src/form/create-form';
import {
  compute,
  computeFrom,
  copyFrom,
  defineFormBehavior,
  disableWhen,
  enableWhen,
  onChange,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
  type FormBehavior,
} from '../../src/form/behaviors';
import type { FormGroup } from '../../src/form/types/index';
import { disposeForm } from '../test-utils/dispose-form';
import { advance, deferred, flushMicrotasks, tick, useFakeClock } from '../test-utils/async';

interface Geo {
  lat: number;
  lng: number;
}
interface Address {
  city: string;
  zip: string;
  geo: Geo;
}
interface Order {
  price: number;
  qty: number;
  total: number;
  manual: boolean;
  email: string;
  notify: string;
  same: boolean;
  tags: string[];
  tagsCopy: string[];
  registration: Address;
  residence: Address;
}

const address = (city = ''): Address => ({ city, zip: '', geo: { lat: 0, lng: 0 } });

const createOrder = (): FormModel<Order> =>
  createModel<Order>({
    price: 2,
    qty: 3,
    total: 0,
    manual: false,
    email: '',
    notify: '',
    same: false,
    tags: ['a'],
    tagsCopy: [],
    registration: address(),
    residence: address(),
  });

const build = (model: FormModel<Order>, behavior: FormBehavior<Order>): FormGroup<Order> =>
  createFormFromModel<Order>({ model, behavior });

/** Схема поведения из одного вызова операторов. */
const behaviorOf = (setup: (m: FormModel<Order>) => void): FormBehavior<Order> =>
  defineFormBehavior<Order>(({ model }) => setup(model));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('operators — compute / computeFrom', () => {
  it('compute: то же значение цель не перезаписывает — подписчики цели молчат', () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) => compute(m.$.total, () => (m.qty > 0 ? 1 : 0)))
    );
    const writes: number[] = [];
    const stop = model.$.total.subscribe((value) => writes.push(value));
    writes.length = 0;

    model.qty = 5; // результат тот же — 1
    model.qty = 0;
    stop();

    expect(writes).toEqual([0]);
  });

  it('compute: пока when ложно, цель не пишется; стало истинно — пересчёт', () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) => compute(m.$.total, () => m.price * m.qty, { when: () => !m.manual }))
    );
    const seen = [model.total];

    model.manual = true;
    model.price = 10;
    seen.push(model.total);
    model.manual = false;
    seen.push(model.total);

    expect(seen).toEqual([6, 6, 30]);
  });

  it('computeFrom: when получает значения источников и отсекает запись', () => {
    const model = createOrder();
    const when = vi.fn((_price: number, qty: number) => qty > 0);
    build(
      model,
      behaviorOf((m) =>
        computeFrom([m.$.price, m.$.qty], m.$.total, (price: number, qty: number) => price * qty, {
          when,
        })
      )
    );

    model.qty = 0;
    const whileZero = model.total;
    model.qty = 4;

    expect({ whileZero, total: model.total, lastArgs: when.mock.lastCall }).toEqual({
      whileZero: 6,
      total: 8,
      lastArgs: [2, 4],
    });
  });
});

describe('operators — признак derived', () => {
  it('compute помечает цель: model.set её не затирает; снятие поведения признак отпускает', () => {
    const model = createOrder();
    const form = build(
      model,
      behaviorOf((m) => compute(m.$.total, () => m.price * m.qty))
    );
    const marked = isDerived(model.$.total);
    model.set({ ...model.get(), price: 5, total: 999 });
    const whileComputed = model.total;

    disposeForm(form);
    model.set({ ...model.get(), total: 999 });

    expect({
      marked,
      whileComputed,
      released: !isDerived(model.$.total),
      after: model.total,
    }).toEqual({ marked: true, whileComputed: 15, released: true, after: 999 });
  });

  it('computeFrom помечает и отпускает так же', () => {
    const model = createOrder();
    const form = build(
      model,
      behaviorOf((m) => computeFrom([m.$.qty], m.$.total, (qty: number) => qty * 100))
    );
    const marked = isDerived(model.$.total);

    disposeForm(form);

    expect([marked, isDerived(model.$.total)]).toEqual([true, false]);
  });

  it('два владельца одной цели: снятие одного признак не отпускает', () => {
    const model = createOrder();
    const first = build(
      model,
      behaviorOf((m) => compute(m.$.total, () => m.price * m.qty))
    );
    const second = build(
      model,
      behaviorOf((m) =>
        computeFrom([m.$.price, m.$.qty], m.$.total, (p: number, q: number) => p * q)
      )
    );

    disposeForm(first);
    const afterFirst = isDerived(model.$.total);
    disposeForm(second);

    expect([afterFirst, isDerived(model.$.total)]).toEqual([true, false]);
  });
});

describe('operators — guard циклов', () => {
  it('ошибка записи в цель, не цикл, пробрасывается как есть', () => {
    // Цель-группа: модель запрещает писать агрегат — это не «расходящийся цикл».
    const model = createOrder();

    expect(() =>
      build(
        model,
        behaviorOf((m) =>
          compute(m.$.residence as unknown as Signal<Address>, () => address(String(m.qty)))
        )
      )
    ).toThrowError(/model\.\$\.residence: запись в «value» узла-группы невозможна/);
  });
});

describe('operators — copyFrom', () => {
  it('лист: transform преобразует значение; пока when ложно, копирования нет', () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) =>
        copyFrom(m.$.email, m.$.notify, {
          when: () => m.same,
          transform: (value) => value.trim().toLowerCase(),
        })
      )
    );

    model.email = '  Anna@Mail.RU ';
    const whileOff = model.notify;
    model.same = true;

    expect([whileOff, model.notify]).toEqual(['', 'anna@mail.ru']);
  });

  it('массив копируется значением целиком, с transform — тоже', () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) => copyFrom(m.$.tags, m.$.tagsCopy, { transform: (tags) => [...tags].sort() }))
    );

    model.tags.push('c');
    model.tags.push('b');

    expect(model.get().tagsCopy).toEqual(['a', 'b', 'c']);
  });

  it('группа: вложенные группы копируются рекурсивно; запись — на микротаске', async () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) => copyFrom(m.$.registration, m.$.residence))
    );

    model.registration.city = 'Казань';
    model.registration.geo.lat = 55;
    const synchronously = model.residence.city;
    await tick();

    expect({ synchronously, residence: model.get().residence }).toEqual({
      synchronously: '',
      residence: { city: 'Казань', zip: '', geo: { lat: 55, lng: 0 } },
    });
  });

  it('группа: пока when ложно, снимок не пишется; стало истинно — копируется текущий', async () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) => copyFrom(m.$.registration, m.$.residence, { when: () => m.same }))
    );

    model.registration.city = 'Казань';
    await tick();
    const whileOff = model.residence.city;
    model.same = true;
    await tick();

    expect([whileOff, model.residence.city]).toEqual(['', 'Казань']);
  });

  it('группа с transform: в цель пишется преобразованное значение [ReFormer-6drw]', async () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) =>
        copyFrom(m.$.registration, m.$.residence, {
          transform: (value) => ({ ...value, zip: value.zip.trim() }),
        })
      )
    );

    model.registration.zip = ' 420000 ';
    await tick();

    expect(model.residence.zip).toBe('420000');
  });

  it('группы разной формы: поля цели, которых нет в источнике, остаются, в dev — предупреждение [ReFormer-nm2x]', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    interface Mismatch {
      short: { city: string };
      long: { city: string; vat: string };
    }
    const model = createModel<Mismatch>({
      short: { city: 'Казань' },
      long: { city: '', vat: '7701' },
    });
    createFormFromModel<Mismatch>({
      model,
      behavior: defineFormBehavior<Mismatch>(({ model: m }) => copyFrom(m.$.short, m.$.long)),
    });
    await tick();

    model.short.city = 'Самара';
    await tick();

    expect({ city: model.long.city, vat: model.long.vat }).toEqual({
      city: 'Самара',
      vat: '7701',
    });
    // Одно предупреждение на оператор, а не на каждую запись.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('«vat»');
    warn.mockRestore();
  });
});

describe('operators — onChange без debounce', () => {
  it('первый прогон молчит; изменение — на микротаске с текущим значением', async () => {
    const model = createOrder();
    const seen: string[] = [];
    build(
      model,
      behaviorOf((m) => onChange(m.$.email, (value) => void seen.push(value)))
    );

    model.email = 'a@b.c';
    const synchronously = [...seen];
    await tick();

    expect({ synchronously, seen }).toEqual({ synchronously: [], seen: ['a@b.c'] });
  });

  it('immediate: колбэк получает и начальное значение', async () => {
    const model = createOrder();
    const seen: number[] = [];
    build(
      model,
      behaviorOf((m) => onChange(m.$.qty, (value) => void seen.push(value), { immediate: true }))
    );

    await tick();
    model.qty = 7;
    await tick();

    expect(seen).toEqual([3, 7]);
  });

  it('новая смена значения аннулирует signal предыдущего вызова', async () => {
    const model = createOrder();
    const signals: AbortSignal[] = [];
    build(
      model,
      behaviorOf((m) => onChange(m.$.email, (_value, { signal }) => void signals.push(signal)))
    );

    model.email = 'a';
    await tick();
    model.email = 'b';
    await tick();

    expect(signals.map((s) => s.aborted)).toEqual([true, false]);
  });

  it('колбэк выполняется вне effect: пишет в читаемое поле без «Cycle detected»', async () => {
    const model = createOrder();
    build(
      model,
      behaviorOf((m) =>
        onChange(m.$.email, (value) => {
          m.email = value.toLowerCase();
        })
      )
    );

    model.email = 'ANNA';
    await tick();

    expect(model.email).toBe('anna');
  });

  it('снятие поведения прерывает signal выполняющегося async-колбэка', async () => {
    const model = createOrder();
    const gate = deferred<void>();
    let inFlight: AbortSignal | undefined;
    const form = build(
      model,
      behaviorOf((m) =>
        onChange(m.$.email, async (_value, { signal }) => {
          inFlight = signal;
          await gate.promise;
        })
      )
    );
    model.email = 'a';
    await tick();
    const beforeDispose = inFlight?.aborted;

    disposeForm(form);
    gate.resolve();

    expect([beforeDispose, inFlight?.aborted]).toEqual([false, true]);
  });
});

describe('operators — onChange с debounce', () => {
  it('серия записей — один вызов с последним значением после паузы', async () => {
    useFakeClock();
    const model = createOrder();
    const seen: string[] = [];
    build(
      model,
      behaviorOf((m) => onChange(m.$.email, (value) => void seen.push(value), { debounce: 300 }))
    );

    model.email = 'a';
    await advance(200);
    model.email = 'ab';
    await advance(200);
    const midway = [...seen];
    await advance(100);
    await flushMicrotasks();

    expect({ midway, seen }).toEqual({ midway: [], seen: ['ab'] });
  });

  it('immediate + debounce: начальное значение тоже идёт через паузу', async () => {
    useFakeClock();
    const model = createOrder();
    const seen: number[] = [];
    build(
      model,
      behaviorOf((m) =>
        onChange(m.$.qty, (value) => void seen.push(value), { immediate: true, debounce: 50 })
      )
    );

    const before = [...seen];
    await advance(50);
    await flushMicrotasks();

    expect([before, seen]).toEqual([[], [3]]);
  });

  it('снятие поведения с ожидающей паузой снимает таймер — колбэка не будет', async () => {
    useFakeClock();
    const model = createOrder();
    const callback = vi.fn();
    const form = build(
      model,
      behaviorOf((m) => onChange(m.$.email, callback, { debounce: 300 }))
    );
    model.email = 'a';
    const pending = vi.getTimerCount();

    disposeForm(form);
    const afterDispose = vi.getTimerCount();
    await advance(1000);
    await flushMicrotasks();

    expect({ pending, afterDispose, calls: callback.mock.calls.length }).toEqual({
      pending: 1,
      afterDispose: 0,
      calls: 0,
    });
  });

  it('снятие поведения без единой записи: таймера не было — снимать нечего', () => {
    useFakeClock();
    const model = createOrder();
    const form = build(
      model,
      behaviorOf((m) => onChange(m.$.email, () => {}, { debounce: 300 }))
    );

    disposeForm(form);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('снятие поведения прерывает signal async-колбэка, начатого после паузы', async () => {
    useFakeClock();
    const model = createOrder();
    const gate = deferred<void>();
    let inFlight: AbortSignal | undefined;
    const form = build(
      model,
      behaviorOf((m) =>
        onChange(
          m.$.email,
          async (_value, { signal }) => {
            inFlight = signal;
            await gate.promise;
          },
          { debounce: 100 }
        )
      )
    );
    model.email = 'a';
    await advance(100);
    await flushMicrotasks();
    const beforeDispose = inFlight?.aborted;

    disposeForm(form);
    gate.resolve();

    expect([beforeDispose, inFlight?.aborted]).toEqual([false, true]);
  });

  // Раньше signal прежнего вызова гас только вместе с отложенным вызовом нового значения: ответ на
  // устаревшее значение, пришедший за время паузы, проходил проверку `signal.aborted`.
  it('смена значения отменяет signal прежнего вызова сразу, не дожидаясь паузы [ReFormer-y66c]', async () => {
    useFakeClock();
    const model = createOrder();
    const signals: AbortSignal[] = [];
    build(
      model,
      behaviorOf((m) =>
        onChange(m.$.email, (_value, { signal }) => void signals.push(signal), { debounce: 300 })
      )
    );
    model.email = 'a';
    await advance(300);
    await flushMicrotasks();
    const beforeChange = signals[0]?.aborted;

    model.email = 'ab'; // пауза нового значения ещё идёт
    const duringPause = signals[0]?.aborted;

    expect({ calls: signals.length, beforeChange, duringPause }).toEqual({
      calls: 1,
      beforeChange: false,
      duringPause: true,
    });
  });
});

describe('operators — enableWhen / disableWhen', () => {
  interface Credit {
    on: boolean;
    amount: number;
    address: { city: string; street: string };
    tags: string[];
    rows: { name: string }[];
  }
  const createCredit = () =>
    createModel<Credit>({
      on: false,
      amount: 100,
      address: { city: 'Казань', street: '' },
      tags: [],
      rows: [{ name: 'первая' }],
    });
  const creditSchema = (model: FormModel<Credit>) => ({
    children: [
      {
        model: model.$.rows,
        item: (row: FormModel<{ name: string }>) => ({ children: [{ model: row.$.name }] }),
      },
    ],
  });
  interface CreditView {
    amount: { disabled: { value: boolean } };
    address: { disabled: { value: boolean }; city: { disabled: { value: boolean } } };
    rows: {
      disabled: { value: boolean };
      at(index: number): { name: { disabled: { value: boolean } } };
    };
  }
  const viewOf = (form: FormGroup<Credit>) => form as unknown as CreditView;

  it('массив целей: лист и группа включаются одним условием', async () => {
    const model = createCredit();
    const form = viewOf(
      createFormFromModel<Credit>({
        model,
        behavior: defineFormBehavior<Credit>(({ model: m }) => {
          enableWhen([m.$.amount, m.$.address], () => m.on);
        }),
      })
    );
    await tick();
    const off = [form.amount.disabled.value, form.address.city.disabled.value];

    model.on = true;
    await tick();

    expect([off, [form.amount.disabled.value, form.address.city.disabled.value]]).toEqual([
      [true, true],
      [false, false],
    ]);
  });

  it('массив под-форм: выключение выключает массив и его строки', async () => {
    const model = createCredit();
    const form = viewOf(
      createFormFromModel<Credit>({
        model,
        schema: creditSchema(model),
        behavior: defineFormBehavior<Credit>(({ model: m }) => {
          enableWhen(m.$.rows, () => m.on);
        }),
      })
    );
    await tick();

    expect([form.rows.disabled.value, form.rows.at(0).name.disabled.value]).toEqual([true, true]);
  });

  it('ручки без ноды в форме — ничего не делают, не бросают, в dev предупреждают [ReFormer-nm2x]', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createCredit();
    const foreign = createCredit(); // другая модель: её ручек нет в реестре этой формы
    const detached = signal(0);

    createFormFromModel<Credit>({
      model,
      behavior: defineFormBehavior<Credit>(({ model: m }) => {
        // массив без item и компонента в схеме не материализован — ноды нет
        enableWhen([m.$.tags, foreign.$.address, detached], () => m.on, { resetOnDisable: true });
      }),
    });
    foreign.address.city = 'Самара';
    model.on = true;
    model.on = false;
    await tick();

    expect({
      city: foreign.address.city,
      errors: error.mock.calls.length,
      warnings: warn.mock.calls.map(
        ([message]) => /enableWhen\("([^"]*)"\)/.exec(String(message))?.[1]
      ),
    }).toEqual({
      city: 'Самара',
      errors: 0,
      warnings: ['tags', 'address', '?'],
    });
  });

  it('ручки без ноды в production — без предупреждения [ReFormer-nm2x]', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createCredit();

    createFormFromModel<Credit>({
      model,
      behavior: defineFormBehavior<Credit>(({ model: m }) => {
        disableWhen(m.$.tags, () => m.on);
      }),
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it('disableWhen — инверсия: выключено, пока условие истинно; resetOnDisable сбрасывает', async () => {
    const model = createCredit();
    const form = viewOf(
      createFormFromModel<Credit>({
        model,
        behavior: defineFormBehavior<Credit>(({ model: m }) => {
          disableWhen(m.$.amount, () => m.on, { resetOnDisable: true });
        }),
      })
    );
    await tick();
    const whileOff = form.amount.disabled.value;
    model.amount = 900;

    model.on = true;
    await tick();

    expect({ whileOff, disabled: form.amount.disabled.value, amount: model.amount }).toEqual({
      whileOff: false,
      disabled: true,
      amount: 100,
    });
  });

  it('группа с resetOnDisable: выключение сбрасывает поля группы к начальным', async () => {
    const model = createCredit();
    const form = viewOf(
      createFormFromModel<Credit>({
        model,
        behavior: defineFormBehavior<Credit>(({ model: m }) => {
          enableWhen(m.$.address, () => m.on, { resetOnDisable: true });
        }),
      })
    );
    model.on = true;
    await tick();
    model.address.city = 'Самара';
    model.address.street = 'Ленина';

    model.on = false;
    await tick();

    expect({ disabled: form.address.disabled.value, address: model.get().address }).toEqual({
      disabled: true,
      address: { city: 'Казань', street: '' },
    });
  });

  it('группа без resetOnDisable: выключение значения не трогает', async () => {
    const model = createCredit();
    createFormFromModel<Credit>({
      model,
      behavior: defineFormBehavior<Credit>(({ model: m }) => {
        enableWhen(m.$.address, () => m.on);
      }),
    });
    model.address.city = 'Самара';

    model.on = false;
    await tick();

    expect(model.address.city).toBe('Самара');
  });
});

describe('operators — value-операции из схемы снимаются вместе с поведением', () => {
  it('transformValue: работает, после снятия поле не трогает', async () => {
    const model = createOrder();
    const form = build(
      model,
      behaviorOf((m) => transformValue(m.$.email, (value) => value.toLowerCase()))
    );
    model.email = 'ANNA';
    await tick();
    const transformed = model.email;

    disposeForm(form);
    model.email = 'BORIS';
    await tick();

    expect([transformed, model.email]).toEqual(['anna', 'BORIS']);
  });

  it('resetWhen: сбрасывает по условию, после снятия — нет', async () => {
    const model = createOrder();
    const form = build(
      model,
      behaviorOf((m) => resetWhen(m.$.notify, () => !m.same, { resetValue: '—' }))
    );
    model.same = true;
    model.notify = 'x';
    model.same = false;
    await tick();
    const reset = model.notify;

    disposeForm(form);
    model.same = true;
    model.notify = 'y';
    model.same = false;
    await tick();

    expect([reset, model.notify]).toEqual(['—', 'y']);
  });

  it('syncFields: синхронизирует с transform в одну сторону, после снятия — нет', async () => {
    const model = createOrder();
    const form = build(
      model,
      behaviorOf((m) => syncFields(m.$.email, m.$.notify, { transform: (v) => v.toUpperCase() }))
    );
    model.email = 'a@b';
    await tick();
    const synced = model.notify;

    disposeForm(form);
    model.email = 'c@d';
    await tick();

    expect([synced, model.notify]).toEqual(['A@B', 'A@B']);
  });

  it('revalidateWhen: зовёт ревалидацию на изменение зависимостей, после снятия — нет', async () => {
    const model = createOrder();
    const revalidate = vi.fn();
    const form = build(
      model,
      behaviorOf((m) => revalidateWhen([m.$.price, m.$.qty], revalidate))
    );
    await tick();
    model.price = 5;
    await tick();
    const calls = revalidate.mock.calls.length;

    disposeForm(form);
    model.qty = 9;
    await tick();

    expect([calls, revalidate.mock.calls.length]).toEqual([1, 1]);
  });
});

describe('operators — вне схемы поведения', () => {
  it('compute, copyFrom и onChange вне схемы бросают понятную ошибку', () => {
    const model = createOrder();

    expect(() => compute(model.$.total, () => 1)).toThrowError(/вне defineFormBehavior/);
    expect(() => copyFrom(model.$.email, model.$.notify)).toThrowError(/вне defineFormBehavior/);
    expect(() => onChange(model.$.email, () => {})).toThrowError(/вне defineFormBehavior/);
  });

  it('compute вне схемы не помечает цель derived [ReFormer-rdo0]', () => {
    const model = createOrder();
    try {
      compute(model.$.total, () => model.price * model.qty);
    } catch {
      // ожидаемая ошибка «вне defineFormBehavior»
    }

    expect(isDerived(model.$.total)).toBe(false);
  });

  it('copyFrom вне схемы ничего не копирует [ReFormer-rdo0]', () => {
    const model = createOrder();
    model.email = 'a@b.c';
    try {
      copyFrom(model.$.email, model.$.notify);
    } catch {
      // ожидаемая ошибка «вне defineFormBehavior»
    }

    expect(model.notify).toBe('');
  });

  it('onChange вне схемы не подписывается на поле [ReFormer-rdo0]', async () => {
    const model = createOrder();
    const callback = vi.fn();
    try {
      onChange(model.$.email, callback);
    } catch {
      // ожидаемая ошибка «вне defineFormBehavior»
    }

    model.email = 'a@b.c';
    await tick();

    expect(callback).not.toHaveBeenCalled();
  });
});
