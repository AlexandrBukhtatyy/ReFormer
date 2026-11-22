/**
 * Unit tests: `createForm` — сборка модели, формы и валидации ОДНИМ вызовом.
 *
 * Проверяет: обе ветки модели (`initial` | `model`), проброс схемы и behavior, фазы `seed`/`setup`
 * (и то, ради чего они разведены), армирование живой проверки снаружи сборки. Проверка, отправка и
 * поток шагов — в `form-level.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { InputStub } from '../../test-utils/stubs';
import { createForm } from '../../../src/form/form-bundle';
import { createModel } from '../../../src/model/index';
import {
  defineFormBehavior,
  computeFrom,
  copyFrom,
  syncFields,
  transformValue,
} from '../../../src/form/behaviors';
import { validate, defineValidation } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';

interface F {
  email: string;
  password: string;
  total: number;
  price: number;
}

const INITIAL: F = { email: '', password: '', total: 0, price: 10 };

const schemaOf = (model: { $: { email: unknown; password: unknown } }) => ({
  children: [
    { model: model.$.email, component: InputStub },
    { model: model.$.password, component: InputStub },
  ],
});

describe('createForm — модель и форма', () => {
  it('создаёт модель из initial и строит форму по схеме', () => {
    const bundle = createForm<F>({
      initial: { ...INITIAL },
      schema: (model) => schemaOf(model) as never,
    });
    expect(bundle.model.get()).toEqual(INITIAL);
    expect(bundle.form.email.component).toBe(InputStub);
    bundle.form.email.setValue('a@b.c');
    expect(bundle.model.email).toBe('a@b.c');
  });

  it('принимает готовую модель (приоритетнее initial)', () => {
    const model = createModel<F>({ ...INITIAL, email: 'ready@x' });
    const bundle = createForm<F>({ model, initial: { ...INITIAL } });
    expect(bundle.model).toBe(model);
    expect(bundle.model.email).toBe('ready@x');
  });

  it('бросает, если не заданы ни initial, ни model', () => {
    expect(() => createForm<F>({})).toThrow(/initial|model/i);
  });

  it('запускает behavior', () => {
    const behavior = defineFormBehavior<F>(({ model }) => {
      computeFrom([model.$.price], model.$.total, (price) => (price as number) * 2);
    });
    const bundle = createForm<F>({ initial: { ...INITIAL }, behavior });
    bundle.model.price = 21;
    expect(bundle.model.total).toBe(42);
  });

  it('без валидации бандл не несёт её поля', () => {
    const bundle = createForm<F>({ initial: { ...INITIAL } });
    expect(bundle.validation).toBeUndefined();
  });
});

describe('createForm — фазы seed/setup', () => {
  it('seed правит модель ДО сборки формы, setup — после', () => {
    const order: string[] = [];
    const bundle = createForm<F>({
      initial: { ...INITIAL },
      schema: (model) => {
        order.push('schema');
        return schemaOf(model) as never;
      },
      seed: (model) => {
        order.push('seed');
        model.email = 'seeded@x';
      },
      setup: (b) => {
        order.push('setup');
        // на этой фазе форма уже есть — иначе правку было бы некуда применить
        expect(b.form.email.value.value).toBe('seeded@x');
      },
    });
    expect(order).toEqual(['seed', 'schema', 'setup']);
    expect(bundle.model.email).toBe('seeded@x');
  });

  it('точка отсчёта своей модели — собранная форма: seed и первые записи поведения', async () => {
    const bundle = createForm<F>({
      initial: { ...INITIAL },
      schema: (model) => schemaOf(model) as never,
      seed: (model) => {
        model.email = 'Ivan@X.ru';
      },
      behavior: defineFormBehavior<F>(({ model }) => {
        // синхронная первая запись и две отложенные — копия пары и нормализация
        copyFrom(model.$.email, model.$.password, { transform: (email) => email + '!' });
        syncFields(model.$.email, model.$.password, { transform: (email) => email + '!' });
        transformValue(model.$.email, (email) => email.toLowerCase());
      }),
    });

    // первые записи поведения выполнены до возврата сборки — ждать микротаск не нужно
    expect([bundle.model.email, bundle.model.password]).toEqual(['ivan@x.ru', 'ivan@x.ru!']);
    expect(bundle.model.isDirty()).toBe(false);

    bundle.model.email = 'other@x.ru';
    await Promise.resolve();
    bundle.form.reset();
    await Promise.resolve();
    expect([bundle.model.email, bundle.model.password]).toEqual(['ivan@x.ru', 'ivan@x.ru!']);
    expect(bundle.model.isDirty()).toBe(false);
  });

  it('точкой отсчёта переданной модели управляет владелец: seed в неё не входит', () => {
    const model = createModel<F>({ ...INITIAL });
    createForm<F>({ model, seed: (m) => void (m.email = 'seeded@x') });
    expect(model.isDirty()).toBe(true);
    model.reset();
    expect(model.email).toBe('');
  });

  it('setup получает тот же бандл, что возвращается наружу', () => {
    let captured: unknown;
    const bundle = createForm<F>({ initial: { ...INITIAL }, setup: (b) => (captured = b) });
    expect(captured).toBe(bundle);
  });
});

describe('живая проверка сборки', () => {
  const emailRules = defineValidation<F>(({ model }) => {
    validate(model.$.email, [required()]);
  });

  it('контроллер формы армится снаружи и гоняет живую валидацию', async () => {
    const model = createModel<F>({ ...INITIAL, email: 'a@b.c' });
    const bundle = createForm<F>({
      model,
      schema: (m) => schemaOf(m) as never,
      validation: { rules: emailRules, strategy: 'change' },
    });
    const v = bundle.validation!;
    expect(bundle.form.email.issues.value).toEqual([]); // фабрика ничего не армировала

    const stop = v.controller.start();
    model.email = ''; // реальное изменение значения — иначе реактивный триггер не сработает
    await Promise.resolve();
    await Promise.resolve();
    expect(bundle.form.email.issues.value.map((e) => e.code)).toContain('required');
    stop();
  });
});
