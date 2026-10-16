/**
 * `FormGroupNode` — группа полей: то, чего нет в `group-node*.test.ts`.
 *
 * `setValue` с неизвестным ключом и с целями `compute` (их пропускают: значением владеет
 * поведение), `reset(partial)` — незаданные поля возвращаются к начальным, рекурсивный
 * `clearIssues`, `getValue` без подписки, идемпотентный `dispose` (`disposeForm` из test-utils —
 * `dispose` в контракт `FormGroup` не входит).
 *
 * Зонды: `disable()` → `enable()` против поля, созданного с `disabled: true`; собственные
 * замечания выключенной группы; `setValue` с `null` на месте вложенной группы.
 */

import { describe, expect, it } from 'vitest';
import { effect } from '@preact/signals-core';
import { arrayOf, createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { markDerived, unmarkDerived } from '../../../src/model/derived-registry';
import { createFormFromModel } from '../../../src/form/create-form';
import { compute, defineFormBehavior, onDispose } from '../../../src/form/behaviors';
import { rawNode } from '../../../src/form/nodes/node-kind';
import { disposeForm } from '../../test-utils/dispose-form';
import { issueCodes } from '../../test-utils/issues';

interface Profile {
  name: string;
  email: string;
  city: string;
}

const createProfile = () => {
  const model = createModel<Profile>({ name: 'Neo', email: 'neo@zion.io', city: 'Zion' });
  return { model, form: createFormFromModel<Profile>({ model }) };
};

interface Phone {
  number: string;
}

interface Person {
  name: string;
  address: { city: string; street: string };
  phones: Phone[];
}

const phoneRow = (row: FormModel<Phone>) => ({ children: [{ model: row.$.number }] });

/** Группа с вложенной группой и массивом под-форм. */
const createPerson = () => {
  const model = createModel<Person>({
    name: 'Neo',
    address: { city: 'Zion', street: 'Main' },
    phones: arrayOf(() => ({ number: '' }), [{ number: '1' }]),
  });
  const form = createFormFromModel<Person>({
    model,
    schema: { children: [{ model: model.$.phones, item: phoneRow }] },
  });
  return { model, form };
};

interface Order {
  price: number;
  quantity: number;
  total: number;
}

describe('form-group-node — setValue', () => {
  it('неизвестный ключ пропускается: известные поля записаны, новых полей нет', () => {
    const { model, form } = createProfile();

    form.setValue({ name: 'Trinity', unknown: 'x' } as unknown as Profile);

    expect(model.get()).toEqual({ name: 'Trinity', email: 'neo@zion.io', city: 'Zion' });
    expect('unknown' in form).toBe(false);
    expect(form.email.dirty.value).toBe(false);
  });

  it('цель compute пропускается: setValue не затирает вычисляемое поле, остальные пишет', () => {
    const model = createModel<Order>({ price: 10, quantity: 2, total: 0 });
    const form = createFormFromModel<Order>({
      model,
      behavior: defineFormBehavior<Order>(({ model: order }) => {
        compute(order.$.total, () => order.price * order.quantity);
      }),
    });
    expect(model.total).toBe(20);

    form.setValue({ price: 5, quantity: 3, total: 999 });

    expect(model.get()).toEqual({ price: 5, quantity: 3, total: 15 });
    expect(form.total.dirty.value).toBe(false);
  });

  it('поле с пометкой markDerived пропускается, после unmarkDerived — пишется', () => {
    const { model, form } = createProfile();
    markDerived(model.$.city);

    form.setValue({ name: 'Trinity', email: 'trinity@zion.io', city: 'Matrix' });
    expect(model.get()).toEqual({ name: 'Trinity', email: 'trinity@zion.io', city: 'Zion' });

    unmarkDerived(model.$.city);
    form.setValue({ name: 'Trinity', email: 'trinity@zion.io', city: 'Matrix' });
    expect(model.city).toBe('Matrix');
  });

  it('derived-поле вложенной группы пропускается и при записи через корень', () => {
    const { model, form } = createPerson();
    markDerived(model.$.address.street);

    form.setValue({ name: 'Neo', address: { city: 'Matrix', street: 'Other' }, phones: [] });

    expect(model.get().address).toEqual({ city: 'Matrix', street: 'Main' });
    unmarkDerived(model.$.address.street);
  });

  it('значение массива под-форм заменяет его строки', () => {
    const { model, form } = createPerson();
    const before = form.phones.at(0);

    form.setValue({
      name: 'Neo',
      address: { city: 'Zion', street: 'Main' },
      phones: [{ number: 'a' }, { number: 'b' }],
    });

    expect(model.get().phones).toEqual([{ number: 'a' }, { number: 'b' }]);
    expect(form.phones.length).toBe(2);
    expect(form.phones.at(0)).not.toBe(before);
  });

  it('setValue с null на месте вложенной группы не бросает [ReFormer-7dce]', () => {
    interface Card {
      name: string;
      address: { city: string } | null;
    }
    const model = createModel<Card>({ name: '', address: { city: 'Zion' } });
    const form = createFormFromModel<Card>({ model });

    expect(() => form.setValue({ name: 'Neo', address: null })).not.toThrow();
  });

  it('getValue — снимок без подписки: эффект с ним не перезапускается', () => {
    const { form } = createProfile();
    let reads = 0;
    const stop = effect(() => {
      reads++;
      form.getValue();
    });

    form.name.setValue('Trinity');
    stop();

    expect(reads).toBe(1);
    expect(form.getValue()).toEqual({ name: 'Trinity', email: 'neo@zion.io', city: 'Zion' });
  });
});

describe('form-group-node — reset(partial)', () => {
  it('переданные поля — к значениям, незаданные и undefined — к начальным', () => {
    const { model, form } = createProfile();
    form.name.setValue('Trinity');
    form.email.setValue('trinity@zion.io');
    form.city.setValue('Matrix');

    form.reset({ name: 'Morpheus', email: undefined } as unknown as Profile);

    expect(model.get()).toEqual({ name: 'Morpheus', email: 'neo@zion.io', city: 'Zion' });
  });

  it('во вложенной группе и массиве незаданное возвращается к начальному', () => {
    const { model, form } = createPerson();
    form.name.setValue('Trinity');
    form.address.city.setValue('Matrix');
    form.address.street.setValue('Other');
    form.phones.push({ number: '2' });

    form.reset({ address: { city: 'Babylon' } } as unknown as Person);

    expect(model.get()).toEqual({
      name: 'Neo',
      address: { city: 'Babylon', street: 'Main' },
      phones: [{ number: '1' }],
    });
  });

  it('снимает touched, dirty и замечания всех полей — и незаданных тоже', () => {
    const { form } = createProfile();
    form.markAsTouched();
    form.email.setValue('x');
    form.email.setIssues([{ code: 'email' }]);
    form.city.setIssues([{ code: 'required' }]);
    form.setIssues([{ code: 'server' }]);

    form.reset({ name: 'Morpheus' } as unknown as Profile);

    expect(form.touched.value).toBe(false);
    expect(form.dirty.value).toBe(false);
    expect(form.issues.value).toEqual([]);
    expect(form.valid.value).toBe(true);
  });
});

describe('form-group-node — clearIssues', () => {
  it('рекурсивно: своя группа, вложенная группа, массив, строки и поля', () => {
    const { form } = createPerson();
    form.setIssues([{ code: 'server' }]);
    form.name.setIssues([{ code: 'required' }]);
    form.address.setIssues([{ code: 'address.cross' }]);
    form.address.city.setIssues([{ code: 'city' }]);
    form.phones.setIssues([{ code: 'phones.min' }]);
    form.phones.at(0)?.setIssues([{ code: 'row' }]);
    form.phones.at(0)?.number.setIssues([{ code: 'number' }]);
    expect(issueCodes(form)).toHaveLength(7);

    form.clearIssues();

    expect(form.issues.value).toEqual([]);
    expect(form.address.ownIssues.value).toEqual([]);
    expect(form.phones.ownIssues.value).toEqual([]);
    expect(form.phones.at(0)?.ownIssues.value).toEqual([]);
    expect(form.valid.value).toBe(true);
  });
});

describe('form-group-node — выключение (зонды)', () => {
  it('disable() и enable() группы не снимают блокировку из схемы (disabled: true) [ReFormer-n8zy]', () => {
    const model = createModel<Order>({ price: 10, quantity: 2, total: 20 });
    const form = createFormFromModel<Order>({
      model,
      schema: {
        children: [
          { model: model.$.price },
          { model: model.$.quantity },
          { model: model.$.total, disabled: true },
        ],
      },
    });
    expect(form.total.disabled.value).toBe(true);

    form.disable();
    form.enable();

    // Решение по n8zy: `disabled: true` узла схемы — постоянная блокировка. Так помечают
    // вычисляемые поля (total, fullName), и цикл «выключить форму на время отправки → включить»
    // их не разблокирует. Остальные поля включаются как обычно.
    expect(form.total.disabled.value).toBe(true);
    expect(form.price.disabled.value).toBe(false);

    // Снимает блокировку только явный enable() самого поля.
    form.total.enable();
    expect(form.total.disabled.value).toBe(false);
    form.disable();
    form.enable();
    expect(form.total.disabled.value).toBe(false);
  });

  it('disable() группы снимает её собственные замечания [ReFormer-z4p9]', () => {
    const { form } = createPerson();
    form.address.setIssues([{ code: 'address.server' }]);

    form.address.disable();

    expect(form.address.ownIssues.value).toEqual([]);
  });

  it('выключенная группа, как и выключенное поле, — ни valid, ни invalid [ReFormer-vnag]', () => {
    const { form } = createPerson();

    form.address.disable();

    // Одно правило (решение по vnag): контракт `valid` — «нода включена и не ждёт проверки», и
    // контейнер ему следует, как поле. На родителя это не влияет — выключенный ребёнок в его
    // `valid` не входит.
    expect(form.address.city.valid.value).toBe(false);
    expect([form.address.valid.value, form.address.invalid.value]).toEqual([false, false]);
    expect(form.valid.value).toBe(true);

    form.address.enable();
    expect(form.address.valid.value).toBe(true);
  });
});

describe('form-group-node — dispose', () => {
  it('dispose снимает поведение: compute больше не пересчитывает', () => {
    const model = createModel<Order>({ price: 10, quantity: 2, total: 0 });
    const form = createFormFromModel<Order>({
      model,
      behavior: defineFormBehavior<Order>(({ model: order }) => {
        compute(order.$.total, () => order.price * order.quantity);
      }),
    });

    disposeForm(form);
    model.price = 100;

    expect(model.total).toBe(20);
  });

  it('повторный dispose не вызывает cleanup поведения второй раз', () => {
    const cleanups: string[] = [];
    const model = createModel<Profile>({ name: '', email: '', city: '' });
    const form = createFormFromModel<Profile>({
      model,
      behavior: defineFormBehavior<Profile>(() => {
        onDispose(() => cleanups.push('behavior'));
      }),
    });

    disposeForm(form);
    disposeForm(form);

    expect(cleanups).toEqual(['behavior']);
  });

  it('dispose группы без поведения безопасен и доходит до массивов', () => {
    const { model, form } = createPerson();

    disposeForm(form);
    disposeForm(form);
    model.phones.push({ number: '2' });

    expect(model.phones.length).toBe(2);
    expect(form.phones.length).toBe(1);
  });
});

describe('form-group-node — ожидание проверки', () => {
  // Раньше setPending группы был пустым, и async-правило на её ручке ожидание не показывало
  // [ReFormer-zo3f].
  it('setPending группы — собственное ожидание: pending, ни valid, ни invalid', () => {
    const { form } = createProfile();

    rawNode(form).setPending(true);
    expect([form.pending.value, form.valid.value, form.invalid.value]).toEqual([
      true,
      false,
      false,
    ]);

    rawNode(form).setPending(false);
    expect(form.pending.value).toBe(false);
  });

  it('ожидание поля поднимается до группы', () => {
    const { form } = createProfile();

    rawNode(form.email).setPending(true);

    expect(form.pending.value).toBe(true);
  });

  it('выключенная группа своё ожидание не показывает', () => {
    const { form } = createProfile();
    rawNode(form).setPending(true);

    form.disable();

    expect(form.pending.value).toBe(false);
  });
});
