/**
 * Unit tests: декларативный фасад схемы поведения (@reformer/core/behaviors).
 * Проверяем runner/ambient-сток, операторы, групповые операции, apply, debounce, dev-guard.
 */

import { describe, it, expect, vi } from 'vitest';
import { createModel } from '../../src/core/model';
import { createForm } from '../../src/core/utils/create-form';
import {
  defineFormBehavior,
  compute,
  copyFrom,
  enableWhen,
  onChange,
  apply,
  effect,
  onDispose,
  transformValue,
} from '../../src/behaviors';
import type { FormProxy } from '../../src/core/types';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

interface Addr {
  region: string;
  zip: string;
}
interface TForm {
  price: number;
  qty: number;
  total: number;
  email: string;
  emailCopy: string;
  same: boolean;
  loanType: string;
  carBrand: string;
  carModel: string;
  sameAddr: boolean;
  addrA: Addr;
  addrB: Addr;
}

const initial = (): TForm => ({
  price: 0,
  qty: 0,
  total: 0,
  email: '',
  emailCopy: '',
  same: false,
  loanType: 'consumer',
  carBrand: '',
  carModel: '',
  sameAddr: false,
  addrA: { region: '', zip: '' },
  addrB: { region: '', zip: '' },
});

// Доступ к node-API без публичной типизации прокси в тесте.
const node = (n: unknown) => n as { disabled: { value: boolean }; value: { value: unknown } };

describe('defineFormBehavior + runner', () => {
  it('compute реактивен и отписывается через form.dispose()', () => {
    const model = createModel<TForm>(initial());
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      compute(m.$.total, () => m.price * m.qty);
    });
    const form = createForm<TForm>({ model, behavior });

    model.price = 10;
    model.qty = 3;
    expect(model.total).toBe(30);

    (form as unknown as { dispose(): void }).dispose();
    model.price = 100;
    expect(model.total).toBe(30); // после dispose не пересчитывается
  });

  it('copyFrom (скаляр) по условию when', () => {
    const model = createModel<TForm>(initial());
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      copyFrom(m.$.email, m.$.emailCopy, { when: () => m.same });
    });
    createForm<TForm>({ model, behavior });

    model.email = 'a@b.c';
    expect(model.emailCopy).toBe(''); // same=false
    model.same = true;
    model.email = 'x@y.z';
    expect(model.emailCopy).toBe('x@y.z');
  });
});

describe('enableWhen', () => {
  it('массив целей; resetOnDisable=false по умолчанию (значение сохраняется)', async () => {
    const model = createModel<TForm>(initial());
    model.carModel = 'corolla';
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      enableWhen([m.$.carBrand, m.$.carModel], () => m.loanType === 'car');
    });
    const form = createForm<TForm>({ model, behavior }) as FormProxy<TForm>;

    await tick();
    expect(node(form.carModel).disabled.value).toBe(true); // consumer → disabled
    expect(model.carModel).toBe('corolla'); // значение НЕ сброшено (resetOnDisable=false)

    model.loanType = 'car';
    await tick();
    expect(node(form.carBrand).disabled.value).toBe(false);
    expect(node(form.carModel).disabled.value).toBe(false);
  });

  it('resetOnDisable: true сбрасывает значение к initial при выключении', async () => {
    const model = createModel<TForm>(initial()); // initial carBrand=''
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      enableWhen([m.$.carBrand], () => m.loanType === 'car', { resetOnDisable: true });
    });
    createForm<TForm>({ model, behavior });

    model.loanType = 'car';
    model.carBrand = 'toyota';
    await tick();
    model.loanType = 'consumer';
    await tick(); // enable/disable + reset отложены через defer (микротаск)
    expect(model.carBrand).toBe('');
  });
});

describe('групповые операции', () => {
  it('copyFrom копирует объект-группу целиком по условию (запись отложена через defer)', async () => {
    const model = createModel<TForm>(initial());
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      copyFrom(m.$.addrA, m.$.addrB, { when: () => m.sameAddr });
    });
    createForm<TForm>({ model, behavior });

    model.addrA = { region: 'NW', zip: '123' };
    await tick();
    expect(model.addrB).toEqual({ region: '', zip: '' }); // sameAddr=false

    model.sameAddr = true;
    await tick();
    expect(model.addrB).toEqual({ region: 'NW', zip: '123' });

    model.addrA = { region: 'SE', zip: '999' };
    await tick();
    expect(model.addrB).toEqual({ region: 'SE', zip: '999' }); // реактивно
  });

  it('enableWhen на группе вкл/выкл ноду группы', async () => {
    const model = createModel<TForm>(initial());
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      enableWhen(m.$.addrB, () => !m.sameAddr);
    });
    const form = createForm<TForm>({ model, behavior }) as FormProxy<TForm>;

    await tick();
    expect(node(form.addrB).disabled.value).toBe(false); // sameAddr=false → enabled

    model.sameAddr = true;
    await tick();
    expect(node(form.addrB).disabled.value).toBe(true);
  });
});

describe('apply (под-схема на несколько групп)', () => {
  it('применяет под-схему к обоим адресам', async () => {
    const model = createModel<TForm>(initial());
    const addressBehavior = defineFormBehavior<Addr>(({ model: m }) => {
      // нормализуем zip к 3 цифрам (идемпотентный self-transform → transformValue, не compute)
      transformValue(m.$.zip, (zip) => (zip ?? '').replace(/\D/g, '').slice(0, 3));
    });
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      apply([m.$.addrA, m.$.addrB], addressBehavior);
    });
    createForm<TForm>({ model, behavior });

    model.addrA = { region: 'X', zip: 'ab12-99' };
    model.addrB = { region: 'Y', zip: '7777' };
    await tick(); // transformValue пишет через runOutsideEffect (микротаск)
    expect(model.addrA.zip).toBe('129'); // 'ab12-99' → '1299' → slice(0,3) → '129'
    expect(model.addrB.zip).toBe('777');
  });
});

describe('onChange debounce', () => {
  it('вызывает callback один раз после debounce', async () => {
    const model = createModel<TForm>(initial());
    const cb = vi.fn();
    const behavior = defineFormBehavior<TForm>(({ model: m }) => {
      onChange(m.$.carBrand, cb, { debounce: 50 });
    });
    createForm<TForm>({ model, behavior });

    model.carBrand = 'a';
    model.carBrand = 'b';
    model.carBrand = 'c';
    expect(cb).not.toHaveBeenCalled(); // ещё не сработал debounce
    await tick(80);
    expect(cb).toHaveBeenCalledTimes(1);
    // onChange теперь передаёт 2-й аргумент { signal } (AbortSignal) — значение по-прежнему первым.
    expect(cb.mock.calls[0][0]).toBe('c');
  });
});

describe('dev-guard', () => {
  it('оператор вне defineFormBehavior бросает понятную ошибку', () => {
    const model = createModel<TForm>(initial());
    expect(() => compute(model.$.total, () => 1)).toThrowError(/defineFormBehavior/);
    expect(() => onDispose(() => {})).toThrowError(/defineFormBehavior/);
    expect(() => effect(() => {})).toThrowError(/defineFormBehavior/);
  });
});
