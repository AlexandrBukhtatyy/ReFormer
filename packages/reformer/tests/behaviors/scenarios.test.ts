/**
 * Стресс-тест контракта схемы поведения (@reformer/core/behaviors) на формах разной сложности.
 * Каждый сценарий = реалистичная форма + схема поведения + проверки.
 * Цель — подтвердить, что контрактом можно описать формы любого уровня сложности.
 */

import { describe, it, expect, vi } from 'vitest';
import { createModel } from '../../src/core/model';
import { createForm } from '../../src/core/utils/create-form';
import {
  defineFormBehavior,
  compute,
  computeFrom,
  copyFrom,
  enableWhen,
  disableWhen,
  onChange,
  transformValue,
  resetWhen,
  revalidateWhen,
  syncFields,
  apply,
  applyEach,
  effect,
  onDispose,
  type ReadonlySignal,
  type Signal,
} from '../../src/behaviors';
import type { FormProxy } from '../../src/core/types';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const node = (n: unknown) => n as { disabled: { value: boolean }; value: { value: unknown } };

// ============================================================================
// Тир 1 — вычисления и кросс-поле
// ============================================================================
describe('Тир 1 · вычисления', () => {
  it('S1 заказ: цепочка subtotal→rate→tax→discount→total', () => {
    interface Order {
      subtotal: number;
      region: string;
      rate: number;
      tax: number;
      discount: number;
      total: number;
    }
    const model = createModel<Order>({
      subtotal: 0,
      region: 'RU',
      rate: 0,
      tax: 0,
      discount: 0,
      total: 0,
    });
    const behavior = defineFormBehavior<Order>(({ model: m }) => {
      compute(m.$.rate, () => (m.region === 'EU' ? 0.2 : 0.1));
      compute(m.$.tax, () => m.subtotal * m.rate);
      compute(m.$.discount, () => (m.subtotal > 1000 ? m.subtotal * 0.1 : 0));
      compute(m.$.total, () => m.subtotal + m.tax - m.discount);
    });
    createForm<Order>({ model, behavior });

    model.subtotal = 2000;
    model.region = 'EU';
    expect(model.rate).toBe(0.2);
    expect(model.tax).toBe(400);
    expect(model.discount).toBe(200);
    expect(model.total).toBe(2200);

    model.region = 'RU';
    expect(model.rate).toBe(0.1);
    expect(model.total).toBe(2000 + 200 - 200);
  });

  it('S2 self-transform: uppercase / digits-only / clamp', async () => {
    interface F {
      code: string;
      phone: string;
      qty: number;
    }
    const model = createModel<F>({ code: '', phone: '', qty: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      transformValue(m.$.code, (v) => (v ?? '').toUpperCase());
      transformValue(m.$.phone, (v) => (v ?? '').replace(/\D/g, ''));
      transformValue(m.$.qty, (v) => Math.max(0, Math.min(100, v ?? 0)));
    });
    createForm<F>({ model, behavior });

    model.code = 'abc';
    model.phone = '+7 (912) 34';
    model.qty = 150;
    await tick();
    expect(model.code).toBe('ABC');
    expect(model.phone).toBe('791234');
    expect(model.qty).toBe(100);
    model.qty = -5;
    await tick();
    expect(model.qty).toBe(0);
  });
});

// ============================================================================
// Тир 2 — условные поля
// ============================================================================
describe('Тир 2 · условные поля', () => {
  it('S3 способ оплаты: card/bank поля по методу (+resetOnDisable)', async () => {
    interface F {
      method: string;
      cardNumber: string;
      cardCvv: string;
      bankAccount: string;
      bankBic: string;
    }
    const model = createModel<F>({
      method: 'card',
      cardNumber: '',
      cardCvv: '',
      bankAccount: '',
      bankBic: '',
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      enableWhen([m.$.cardNumber, m.$.cardCvv], () => m.method === 'card', {
        resetOnDisable: true,
      });
      enableWhen([m.$.bankAccount, m.$.bankBic], () => m.method === 'bank', {
        resetOnDisable: true,
      });
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;
    await tick();
    expect(node(form.cardNumber).disabled.value).toBe(false);
    expect(node(form.bankAccount).disabled.value).toBe(true);

    model.cardNumber = '4111';
    model.method = 'bank';
    await tick();
    expect(node(form.cardNumber).disabled.value).toBe(true);
    expect(model.cardNumber).toBe(''); // сброшено
    expect(node(form.bankAccount).disabled.value).toBe(false);
  });

  it('S4 каскад условий: C активно только когда A и B заполнены', async () => {
    interface F {
      a: string;
      b: string;
      c: string;
    }
    const model = createModel<F>({ a: '', b: '', c: '' });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      enableWhen(m.$.c, () => Boolean(m.a) && Boolean(m.b));
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;
    await tick();
    expect(node(form.c).disabled.value).toBe(true);
    model.a = 'x';
    await tick();
    expect(node(form.c).disabled.value).toBe(true);
    model.b = 'y';
    await tick();
    expect(node(form.c).disabled.value).toBe(false);
  });
});

// ============================================================================
// Тир 3 — копирование / синхронизация
// ============================================================================
describe('Тир 3 · копирование/синхронизация', () => {
  it('S5 billing = shipping (групповой copyFrom по флагу)', async () => {
    interface Addr {
      street: string;
      city: string;
    }
    interface F {
      sameAsShipping: boolean;
      shipping: Addr;
      billing: Addr;
    }
    const model = createModel<F>({
      sameAsShipping: false,
      shipping: { street: '', city: '' },
      billing: { street: '', city: '' },
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      copyFrom(m.$.shipping, m.$.billing, { when: () => m.sameAsShipping });
    });
    createForm<F>({ model, behavior });

    model.shipping = { street: 'Main', city: 'NYC' };
    model.sameAsShipping = true;
    await tick();
    expect(model.billing).toEqual({ street: 'Main', city: 'NYC' });
    model.shipping = { street: 'Oak', city: 'LA' };
    await tick();
    expect(model.billing).toEqual({ street: 'Oak', city: 'LA' });
  });

  it('S6 syncFields — двусторонний mirror', async () => {
    interface F {
      a: string;
      b: string;
    }
    const model = createModel<F>({ a: '', b: '' });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      syncFields(m.$.a, m.$.b);
    });
    createForm<F>({ model, behavior });

    model.a = 'left';
    await tick();
    expect(model.b).toBe('left');
    model.b = 'right';
    await tick();
    expect(model.a).toBe('right');
  });

  it('S7 resetWhen + revalidateWhen', async () => {
    interface F {
      hasCoupon: boolean;
      coupon: string;
      max: number;
    }
    const model = createModel<F>({ hasCoupon: true, coupon: '', max: 0 });
    const revalidate = vi.fn();
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      resetWhen(m.$.coupon, () => !m.hasCoupon, { resetValue: '' });
      revalidateWhen([m.$.max], revalidate);
    });
    createForm<F>({ model, behavior });

    model.coupon = 'SALE';
    model.hasCoupon = false;
    await tick();
    expect(model.coupon).toBe('');

    expect(revalidate).not.toHaveBeenCalled(); // не на инициализации
    model.max = 100;
    await tick();
    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Тир 4 — асинхронные зависимые справочники
// ============================================================================
describe('Тир 4 · async-каскад', () => {
  it('S8 country→region→city: сброс нижестоящих + debounce загрузки', async () => {
    interface F {
      country: string;
      region: string;
      city: string;
    }
    const model = createModel<F>({ country: '', region: '', city: '' });
    const loadCalls: string[] = [];
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      // debounced loader
      onChange(m.$.country, (c) => loadCalls.push(c), { debounce: 30 });
      // cascade reset
      onChange(m.$.country, () => {
        m.region = '';
        m.city = '';
      });
      onChange(m.$.region, () => {
        m.city = '';
      });
    });
    createForm<F>({ model, behavior });

    model.region = 'pre';
    model.city = 'pre';
    model.country = 'US';
    await tick(); // cascade reset (deferred)
    expect(model.region).toBe('');
    expect(model.city).toBe('');

    // debounce: быстрые смены → один вызов с последним значением
    model.country = 'A';
    model.country = 'B';
    model.country = 'C';
    await tick(60);
    expect(loadCalls.at(-1)).toBe('C');
    // 'US' + последний из A/B/C = максимум 2 вызова (не 4)
    expect(loadCalls.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// Тир 5 — массивы: агрегация (работает из коробки)
// ============================================================================
describe('Тир 5 · массивы (агрегация)', () => {
  it('S9 инвойс: orderTotal = Σ(qty*price), реактивно на add/remove/правку', () => {
    interface Item {
      qty: number;
      price: number;
    }
    interface F {
      items: Item[];
      orderTotal: number;
    }
    const model = createModel<F>({ items: [], orderTotal: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.orderTotal, () =>
        m.items.map((i) => (i.qty as number) * (i.price as number)).reduce((a, b) => a + b, 0)
      );
    });
    createForm<F>({ model, behavior });

    expect(model.orderTotal).toBe(0);
    model.items.push({ qty: 2, price: 10 });
    model.items.push({ qty: 3, price: 5 });
    expect(model.orderTotal).toBe(35); // 20 + 15

    model.items.at(0).qty = 5;
    expect(model.orderTotal).toBe(65); // 50 + 15

    model.items.removeAt(1);
    expect(model.orderTotal).toBe(50);
  });

  it('S10 секция по длине массива + агрегаты count/hasOverLimit', async () => {
    interface Item {
      qty: number;
    }
    interface F {
      items: Item[];
      itemCount: number;
      hasOverLimit: boolean;
      discountCode: string;
    }
    const model = createModel<F>({
      items: [],
      itemCount: 0,
      hasOverLimit: false,
      discountCode: '',
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.itemCount, () => m.items.length);
      compute(m.$.hasOverLimit, () => m.items.map((i) => i.qty as number).some((q) => q > 10));
      enableWhen(m.$.discountCode, () => m.items.length > 0);
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;
    await tick();
    expect(model.itemCount).toBe(0);
    expect(node(form.discountCode).disabled.value).toBe(true);

    model.items.push({ qty: 3 });
    await tick();
    expect(model.itemCount).toBe(1);
    expect(model.hasOverLimit).toBe(false);
    expect(node(form.discountCode).disabled.value).toBe(false);

    model.items.push({ qty: 15 });
    expect(model.hasOverLimit).toBe(true);
  });
});

// ============================================================================
// Тир 6 — массивы: per-item поведение (applyEach закрывает гэп)
// ============================================================================
describe('Тир 6 · массивы (per-item)', () => {
  it('S11 per-row lineTotal = qty*price; add/remove корректно', () => {
    interface Item {
      qty: number;
      price: number;
      lineTotal: number;
    }
    interface F {
      items: Item[];
    }
    const model = createModel<F>({ items: [] });
    const rowBehavior = defineFormBehavior<Item>(({ model: row }) => {
      compute(row.$.lineTotal, () => row.qty * row.price);
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      applyEach(m.$.items, rowBehavior);
    });
    createForm<F>({ model, behavior });

    model.items.push({ qty: 2, price: 10, lineTotal: 0 });
    model.items.push({ qty: 3, price: 4, lineTotal: 0 });
    expect(model.items.at(0).lineTotal).toBe(20);
    expect(model.items.at(1).lineTotal).toBe(12);

    // правка строки → её lineTotal пересчитывается
    model.items.at(0).qty = 5;
    expect(model.items.at(0).lineTotal).toBe(50);

    // новая строка получает поведение
    model.items.push({ qty: 7, price: 2, lineTotal: 0 });
    expect(model.items.at(2).lineTotal).toBe(14);

    // удаление строки — без ошибок, остальные считают
    model.items.removeAt(1);
    expect(model.items.at(0).lineTotal).toBe(50);
    expect(model.items.at(1).lineTotal).toBe(14);
  });

  it('S12 per-row lineTotal + родительский orderTotal', () => {
    interface Item {
      qty: number;
      price: number;
      lineTotal: number;
    }
    interface F {
      items: Item[];
      orderTotal: number;
    }
    const model = createModel<F>({ items: [], orderTotal: 0 });
    const rowBehavior = defineFormBehavior<Item>(({ model: row }) => {
      compute(row.$.lineTotal, () => row.qty * row.price);
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      applyEach(m.$.items, rowBehavior);
      compute(m.$.orderTotal, () =>
        m.items.map((i) => i.lineTotal as number).reduce((a, b) => a + b, 0)
      );
    });
    createForm<F>({ model, behavior });

    model.items.push({ qty: 2, price: 10, lineTotal: 0 });
    model.items.push({ qty: 1, price: 100, lineTotal: 0 });
    expect(model.orderTotal).toBe(120); // 20 + 100
    model.items.at(1).price = 50;
    expect(model.orderTotal).toBe(70); // 20 + 50
  });
});

// ============================================================================
// Тир 7 — переиспользование / вложенность
// ============================================================================
describe('Тир 7 · переиспользование/вложенность', () => {
  it('S13 apply под-схемы адреса к двум вложенным группам', async () => {
    interface Addr {
      region: string;
      zip: string;
    }
    interface F {
      person: { address: Addr };
      company: { address: Addr };
    }
    const model = createModel<F>({
      person: { address: { region: '', zip: '' } },
      company: { address: { region: '', zip: '' } },
    });
    const addressBehavior = defineFormBehavior<Addr>(({ model: a }) => {
      transformValue(a.$.zip, (z) => (z ?? '').replace(/\D/g, '').slice(0, 5));
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      apply([m.$.person.address, m.$.company.address], addressBehavior);
    });
    createForm<F>({ model, behavior });

    model.person.address.zip = 'ab123-99';
    model.company.address.zip = '7777';
    await tick();
    expect(model.person.address.zip).toBe('12399');
    expect(model.company.address.zip).toBe('7777');
  });

  it('S14 под-схема с пользовательским оператором внутри', async () => {
    interface Addr {
      zip: string;
    }
    interface F {
      home: Addr;
      work: Addr;
    }
    const maskDigits = (signal: Signal<string>) =>
      transformValue(signal, (v) => (v ?? '').replace(/\D/g, ''));
    const addressBehavior = defineFormBehavior<Addr>(({ model: a }) => {
      maskDigits(a.$.zip);
    });
    const model = createModel<F>({ home: { zip: '' }, work: { zip: '' } });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      apply([m.$.home, m.$.work], addressBehavior);
    });
    createForm<F>({ model, behavior });

    model.home.zip = 'a1b2';
    await tick();
    expect(model.home.zip).toBe('12');
  });
});

// ============================================================================
// Тир 8 — пользовательские операторы (открытость контракта)
// ============================================================================
describe('Тир 8 · пользовательские операторы', () => {
  it('S15 доменные операторы: clampRange / maskDigits / mirrorWith', async () => {
    interface F {
      score: number;
      phone: string;
      src: string;
      mirror: string;
    }
    // композиция готовых операторов — неотличимы от встроенных на месте вызова
    const clampRange = (s: Signal<number>, min: number, max: number) =>
      transformValue(s, (v) => Math.max(min, Math.min(max, v ?? 0)));
    const maskDigits = (s: Signal<string>) =>
      transformValue(s, (v) => (v ?? '').replace(/\D/g, ''));
    const mirrorWith = <T>(src: ReadonlySignal<T>, dst: Signal<T>) => compute(dst, () => src.value);

    const model = createModel<F>({ score: 0, phone: '', src: '', mirror: '' });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      clampRange(m.$.score, 0, 10);
      maskDigits(m.$.phone);
      mirrorWith(m.$.src, m.$.mirror);
    });
    createForm<F>({ model, behavior });

    model.score = 42;
    model.phone = '8-800-555';
    await tick();
    expect(model.score).toBe(10);
    expect(model.phone).toBe('8800555'); // '8-800-555' → цифры → '8800555'

    model.src = 'hello';
    expect(model.mirror).toBe('hello'); // mirrorWith через compute — синхронно
  });

  it('S16 низкоуровневый оператор через effect/onDispose', () => {
    interface F {
      value: string;
    }
    const store: Record<string, string> = {};
    const spy = vi.fn();
    // оператор: зеркалит поле во внешний store (effect) + регистрирует teardown (onDispose)
    const persist = (s: ReadonlySignal<string>, key: string) => {
      effect(() => {
        store[key] = s.value;
      });
      onDispose(spy);
    };
    const model = createModel<F>({ value: 'init' });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      persist(m.$.value, 'draft');
    });
    const form = createForm<F>({ model, behavior });

    expect(store.draft).toBe('init');
    model.value = 'next';
    expect(store.draft).toBe('next');

    (form as unknown as { dispose(): void }).dispose();
    expect(spy).toHaveBeenCalledTimes(1);
    model.value = 'after';
    expect(store.draft).toBe('next'); // эффект отписан
  });
});

// ============================================================================
// Тир 9 — жизненный цикл и guard
// ============================================================================
describe('Тир 9 · lifecycle & guard', () => {
  it('S17 form.dispose() останавливает все эффекты', () => {
    interface F {
      price: number;
      qty: number;
      total: number;
    }
    const model = createModel<F>({ price: 0, qty: 0, total: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.total, () => m.price * m.qty);
    });
    const form = createForm<F>({ model, behavior });
    model.price = 10;
    model.qty = 2;
    expect(model.total).toBe(20);
    (form as unknown as { dispose(): void }).dispose();
    model.price = 100;
    expect(model.total).toBe(20); // заморожено
  });

  it('S18 dev-guard: операторы вне defineFormBehavior бросают ошибку', () => {
    const model = createModel<{ x: number }>({ x: 0 });
    expect(() => compute(model.$.x, () => 1)).toThrowError(/defineFormBehavior/);
    expect(() => onChange(model.$.x, () => {})).toThrowError(/defineFormBehavior/);
    expect(() => onDispose(() => {})).toThrowError(/defineFormBehavior/);
  });
});

// ============================================================================
// Тир 10 — продвинутые/краевые кейсы
// ============================================================================
describe('Тир 10 · продвинутые кейсы', () => {
  it('S19 computeFrom с явными зависимостями', () => {
    interface F {
      a: number;
      b: number;
      noise: number;
      sum: number;
    }
    const model = createModel<F>({ a: 0, b: 0, noise: 0, sum: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      computeFrom([m.$.a, m.$.b], m.$.sum, (a, b) => a + b);
    });
    createForm<F>({ model, behavior });

    model.a = 3;
    model.b = 4;
    expect(model.sum).toBe(7);
    const before = model.sum;
    model.noise = 999; // не в зависимостях → пересчёта нет
    expect(model.sum).toBe(before);
  });

  it('S20 цепочка: агрегат массива → условие → enable/disable', async () => {
    interface Item {
      price: number;
    }
    interface F {
      items: Item[];
      orderTotal: number;
      freeShipping: boolean;
      shippingCost: number;
    }
    const model = createModel<F>({
      items: [],
      orderTotal: 0,
      freeShipping: false,
      shippingCost: 0,
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.orderTotal, () =>
        m.items.map((i) => i.price as number).reduce((a, b) => a + b, 0)
      );
      compute(m.$.freeShipping, () => m.orderTotal >= 100);
      disableWhen(m.$.shippingCost, () => m.freeShipping); // бесплатная доставка → поле стоимости off
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;

    model.items.push({ price: 40 });
    await tick();
    expect(model.freeShipping).toBe(false);
    expect(node(form.shippingCost).disabled.value).toBe(false);

    model.items.push({ price: 80 }); // total 120 ≥ 100
    await tick();
    expect(model.orderTotal).toBe(120);
    expect(model.freeShipping).toBe(true);
    expect(node(form.shippingCost).disabled.value).toBe(true);
  });

  it('S21 кросс-строчная координация: единственный primary в массиве', async () => {
    interface Contact {
      name: string;
      primary: boolean;
    }
    interface F {
      contacts: Contact[];
    }
    const model = createModel<F>({ contacts: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      // под-схема строки замыкается на родительскую модель → может «погасить» сиблингов
      applyEach(
        m.$.contacts,
        defineFormBehavior<Contact>(({ model: row }) => {
          onChange(row.$.primary, (isPrimary) => {
            if (!isPrimary) return;
            m.contacts.forEach((c) => {
              if (c !== row && c.primary) c.primary = false;
            });
          });
        })
      );
    });
    createForm<F>({ model, behavior });

    model.contacts.push({ name: 'a', primary: false });
    model.contacts.push({ name: 'b', primary: false });
    model.contacts.push({ name: 'c', primary: false });

    model.contacts.at(0).primary = true;
    await tick();
    expect(model.contacts.at(0).primary).toBe(true);

    model.contacts.at(2).primary = true; // выбираем другую → первая гаснет
    await tick();
    expect(model.contacts.at(0).primary).toBe(false);
    expect(model.contacts.at(2).primary).toBe(true);
  });

  it('S22 applyEach: удаление середины и правка оставшихся (стабильность идентичности)', () => {
    interface Item {
      qty: number;
      price: number;
      lineTotal: number;
    }
    interface F {
      items: Item[];
    }
    const model = createModel<F>({ items: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      applyEach(
        m.$.items,
        defineFormBehavior<Item>(({ model: row }) => {
          compute(row.$.lineTotal, () => row.qty * row.price);
        })
      );
    });
    createForm<F>({ model, behavior });

    model.items.push({ qty: 1, price: 10, lineTotal: 0 }); // [10]
    model.items.push({ qty: 2, price: 10, lineTotal: 0 }); // [10,20]
    model.items.push({ qty: 3, price: 10, lineTotal: 0 }); // [10,20,30]
    model.items.removeAt(1); // → [row0, row2]
    // правим оставшиеся — поведение сохранилось у обоих
    model.items.at(0).price = 100; // 1*100
    model.items.at(1).qty = 5; // 5*10
    expect(model.items.at(0).lineTotal).toBe(100);
    expect(model.items.at(1).lineTotal).toBe(50);
  });

  it('S23 applyEach: глубоко вложенное поле в строке (row.$.address.zip)', () => {
    interface Item {
      address: { zip: string };
    }
    interface F {
      rows: Item[];
    }
    const model = createModel<F>({ rows: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      applyEach(
        m.$.rows,
        defineFormBehavior<Item>(({ model: row }) => {
          transformValue(row.$.address.zip, (z) => (z ?? '').replace(/\D/g, '').slice(0, 5));
        })
      );
    });
    createForm<F>({ model, behavior });

    model.rows.push({ address: { zip: '' } });
    model.rows.at(0).address.zip = 'ab123-99';
    return Promise.resolve().then(() => {
      expect(model.rows.at(0).address.zip).toBe('12399');
    });
  });
});
