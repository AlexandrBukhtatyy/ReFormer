/**
 * Unit-тесты единого выбора стратегии валидации — `createFormValidation` + `eachLeafSignal`.
 *
 * Покрывает: submit (реактивно молчит, validate() метит touched), change (прогон по вводу, touch:false),
 * blur (прогон по touched), afterFirstSubmit (тихо до submit → live), debounce, dispose, isValidating,
 * обход листьев (вложенные группы + массивы).
 */

import { describe, it, expect, vi } from 'vitest';
import { createModel } from '../../../src/state/index';
import { createForm } from '../../../src/form/create-form';
import { required, minLength } from '../../../src/form/validators';
import { validate, defineValidationSchema } from '../../../src/form/validation-schema';
import { createFormValidation } from '../../../src/form/validation-strategy';
import { eachLeafSignal } from '../../../src/state/form-model';

const C = () => null;

interface F {
  name: string;
  age: number;
  items: { label: string }[];
  profile: { city: string };
}

const INITIAL: F = { name: '', age: 0, items: [{ label: '' }], profile: { city: '' } };

function makeForm(over: Partial<F> = {}) {
  const model = createModel<F>({ ...INITIAL, ...over });
  const schema = {
    component: C,
    children: [
      { value: model.$.name, component: C },
      { value: model.$.age, component: C },
      { value: model.$.profile.city, component: C },
    ],
  };
  const form = createForm<F>({ model, schema });
  return { model, form };
}

/** Схема: name обязателен и ≥2 символов. Стабильная ссылка (важно для дедупа раннера). */
const nameRequired = defineValidationSchema<F>(({ model }) => {
  validate(model.$.name, [required({ message: 'req' }), minLength(2, { message: 'min2' })]);
});

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('createFormValidation — стратегии запуска', () => {
  it('submit: реактивно молчит; validate() прогоняет и метит touched', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'submit' });
    const dispose = ctrl.start();

    model.name = 'x'; // изменение НЕ должно прогонять при submit-стратегии
    await flush();
    expect(form.name.errors.value).toEqual([]);
    expect(form.name.touched.value).toBe(false);

    const ok = await ctrl.validate();
    expect(ok).toBe(false); // 'x' короче 2
    expect(form.name.errors.value.map((e) => e.code)).toContain('minLength');
    expect(form.name.touched.value).toBe(true); // touch:true раскрыл ошибку

    dispose();
  });

  it('change: изменение значения прогоняет схему (touch:false, initial пропущен)', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'change' });
    ctrl.start();

    expect(form.name.errors.value).toEqual([]); // инициализирующий прогон пропущен

    model.name = 'x'; // невалидно (minLength)
    await flush();
    expect(form.name.errors.value.map((e) => e.code)).toContain('minLength');
    expect(form.name.touched.value).toBe(false); // change НЕ метит touched

    model.name = 'Иван'; // валидно
    await flush();
    expect(form.name.errors.value).toEqual([]);

    ctrl.dispose();
  });

  it('blur: пометка touched прогоняет схему', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'blur' });
    ctrl.start();

    expect(form.name.errors.value).toEqual([]);
    form.name.markAsTouched(); // blur
    await flush();
    expect(form.name.errors.value.map((e) => e.code)).toContain('required');

    ctrl.dispose();
  });

  it('afterFirstSubmit: тихо до validate(), затем live', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, {
      strategy: 'afterFirstSubmit',
      liveAfterSubmit: 'change',
    });
    ctrl.start();

    model.name = 'x';
    await flush();
    expect(form.name.errors.value).toEqual([]); // тихо до первого submit

    await ctrl.validate();
    expect(form.name.errors.value.map((e) => e.code)).toContain('minLength');

    model.name = 'Иван'; // теперь live
    await flush();
    expect(form.name.errors.value).toEqual([]);

    ctrl.dispose();
  });

  it('change + debounce: прогон откладывается на debounce мс', async () => {
    vi.useFakeTimers();
    try {
      const { model, form } = makeForm();
      const ctrl = createFormValidation(model, nameRequired, { strategy: 'change', debounce: 300 });
      ctrl.start();

      model.name = 'x';
      await Promise.resolve();
      expect(form.name.errors.value).toEqual([]); // ещё не прогнали — таймер не сработал

      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
      expect(form.name.errors.value.map((e) => e.code)).toContain('minLength');

      ctrl.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispose: снимает подписки — изменения больше не прогоняют', async () => {
    const { model, form } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'change' });
    ctrl.start();
    ctrl.dispose();

    model.name = 'x';
    await flush();
    expect(form.name.errors.value).toEqual([]); // после dispose прогонов нет
  });

  it('isValidating отражает in-flight прогон', async () => {
    const { model } = makeForm();
    const ctrl = createFormValidation(model, nameRequired, { strategy: 'submit' });

    const p = ctrl.validate();
    expect(ctrl.isValidating).toBe(true);
    await p;
    expect(ctrl.isValidating).toBe(false);
  });
});

describe('eachLeafSignal — обход листьев модели', () => {
  it('обходит листья вложенных групп и элементов массива', () => {
    const model = createModel<F>({
      name: 'a',
      age: 1,
      items: [{ label: 'x' }, { label: 'y' }],
      profile: { city: 'c' },
    });
    const paths: string[] = [];
    eachLeafSignal(model, (sig) => paths.push((sig as unknown as { __path: string }).__path));

    expect(paths.sort()).toEqual(
      ['age', 'items.0.label', 'items.1.label', 'name', 'profile.city'].sort()
    );
  });
});
