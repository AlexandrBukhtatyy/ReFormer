/**
 * Unit tests: `createCoreForm` — сборка модели, формы и валидации ОДНИМ вызовом.
 *
 * Проверяет: обе ветки модели (`initial` | `model`), проброс схемы и behavior, фазы `seed`/`setup`
 * (и то, ради чего они разведены), сборку валидации из шагов, стабильность ссылки на полную схему.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCoreForm } from '../../../src/form/create-core-form';
import { buildValidation } from '../../../src/form/validation/config';
import { createModel } from '../../../src/state/index';
import { defineFormBehavior, computeFrom } from '../../../src/form/behaviors';
import { validate, defineValidationSchema } from '../../../src/form/validation/schema';
import { required, minLength } from '../../../src/form/validators';

const InputStub = () => null;

interface F {
  email: string;
  password: string;
  total: number;
  price: number;
}

const INITIAL: F = { email: '', password: '', total: 0, price: 10 };

const schemaOf = (model: { $: { email: unknown; password: unknown } }) => ({
  children: [
    { value: model.$.email, component: InputStub },
    { value: model.$.password, component: InputStub },
  ],
});

describe('createCoreForm — модель и форма', () => {
  it('создаёт модель из initial и строит форму по схеме', () => {
    const bundle = createCoreForm<F>({
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
    const bundle = createCoreForm<F>({ model, initial: { ...INITIAL } });
    expect(bundle.model).toBe(model);
    expect(bundle.model.email).toBe('ready@x');
  });

  it('бросает, если не заданы ни initial, ни model', () => {
    expect(() => createCoreForm<F>({})).toThrow(/initial|model/i);
  });

  it('запускает behavior', () => {
    const behavior = defineFormBehavior<F>(({ model }) => {
      computeFrom([model.$.price], model.$.total, (price) => (price as number) * 2);
    });
    const bundle = createCoreForm<F>({ initial: { ...INITIAL }, behavior });
    bundle.model.price = 21;
    expect(bundle.model.total).toBe(42);
  });

  it('без валидации бандл не несёт её поля', () => {
    const bundle = createCoreForm<F>({ initial: { ...INITIAL } });
    expect(bundle.validation).toBeUndefined();
  });
});

describe('createCoreForm — фазы seed/setup', () => {
  it('seed правит модель ДО сборки формы, setup — после', () => {
    const order: string[] = [];
    const bundle = createCoreForm<F>({
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

  it('setup получает тот же бандл, что возвращается наружу', () => {
    let captured: unknown;
    const bundle = createCoreForm<F>({ initial: { ...INITIAL }, setup: (b) => (captured = b) });
    expect(captured).toBe(bundle);
  });
});

describe('buildValidation', () => {
  const emailRules = defineValidationSchema<F>(({ model }) => {
    validate(model.$.email, [required({ message: 'req' })]);
  });
  const passwordRules = defineValidationSchema<F>(({ model }) => {
    validate(model.$.password, [minLength(8, { message: 'min8' })]);
  });

  it('без правил возвращает undefined', () => {
    expect(buildValidation(createModel<F>({ ...INITIAL }), undefined)).toBeUndefined();
  });

  it('принимает голую схему (сахар для простых форм)', async () => {
    const model = createModel<F>({ ...INITIAL });
    const v = buildValidation(model, emailRules)!;
    expect(v.schema).toBe(emailRules); // ссылка сохранена — от неё зависит дедупликация прогонов
    expect(await v.validateAll()).toBe(false);
    model.email = 'a@b.c';
    expect(await v.validateAll()).toBe(true);
  });

  it('validateStep проверяет правила своего шага — по номеру и по селектору', async () => {
    // `123` короче 8 — правило шага `security` сработает; пустую строку minLength пропускает
    // (за пустоту отвечает required), поэтому берём заведомо короткое непустое значение.
    const model = createModel<F>({ ...INITIAL, email: 'a@b.c', password: '123' });
    const v = buildValidation(model, {
      steps: { account: emailRules, security: passwordRules, confirm: null },
    })!;
    expect(v.stepSelectors).toEqual(['account', 'security', 'confirm']);
    expect(await v.validateStep(1)).toBe(true); // email заполнен
    expect(await v.validateStep('security')).toBe(false); // пароль короткий
    expect(await v.validateStep('confirm')).toBe(true); // шаг без правил объявлен явно
  });

  it('validateAll собирает шаги вместе с extras', async () => {
    const model = createModel<F>({ ...INITIAL, email: 'a@b.c', password: '' });
    const extras = defineValidationSchema<F>(({ model: m }) => {
      validate(m.$.password, [required({ message: 'pwd-req' })]);
    });
    const v = buildValidation(model, { steps: { a: emailRules }, extras })!;
    expect(await v.validateStep('a')).toBe(true); // extras в шаг не входят
    expect(await v.validateAll()).toBe(false); // а в полный прогон — входят
  });

  it('полная схема собирается один раз (стабильная ссылка)', async () => {
    const model = createModel<F>({ ...INITIAL });
    const v = buildValidation(model, { steps: { a: emailRules } })!;
    const first = v.schema;
    await v.validateAll();
    await v.validateAll();
    expect(v.schema).toBe(first);
  });

  it('createStepController: null при стратегии submit и для шага без правил', () => {
    const model = createModel<F>({ ...INITIAL });
    const submitOnly = buildValidation(model, { steps: { a: emailRules } })!;
    expect(submitOnly.createStepController(1)).toBeNull();

    const live = buildValidation(model, {
      steps: { a: emailRules, b: null },
      strategy: 'change',
    })!;
    expect(live.createStepController('a')).not.toBeNull();
    expect(live.createStepController('b')).toBeNull();
  });

  it('контроллер формы армится снаружи и гоняет живую валидацию', async () => {
    const model = createModel<F>({ ...INITIAL, email: 'a@b.c' });
    const bundle = createCoreForm<F>({
      model,
      schema: (m) => schemaOf(m) as never,
      validation: { schema: emailRules, strategy: 'change' },
    });
    const v = bundle.validation!;
    expect(bundle.form.email.errors.value).toEqual([]); // фабрика ничего не армировала

    const stop = v.controller.start();
    model.email = ''; // реальное изменение значения — иначе реактивный триггер не сработает
    await Promise.resolve();
    await Promise.resolve();
    expect(bundle.form.email.errors.value.map((e) => e.code)).toContain('required');
    stop();
  });

  it('validate — синоним validateAll', () => {
    const model = createModel<F>({ ...INITIAL });
    const v = buildValidation(model, emailRules)!;
    const spy = vi.spyOn(v.controller, 'validate');
    void v.validate();
    void v.validateAll();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
