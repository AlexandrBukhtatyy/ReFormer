import { describe, it, expect, vi } from 'vitest';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { RenderBehaviorFn } from '@reformer/renderer-react';
import { createJsonForm } from './create-json-form';
import { defineJsonSchema } from './types/json-schema';
import { defineRegistry } from './registry/component-registry';
import { FIELD_WRAPPER } from './registry/constants';

const Stub = (): null => null;

const registry = defineRegistry((reg) => {
  reg.component('Box', Stub);
  reg.component('Input', Stub);
  reg.component(FIELD_WRAPPER, Stub);
});

interface F {
  email: string;
  agree: boolean;
}

const schema = defineJsonSchema<F>({
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      { value: '$model(email)', component: '$component(Input)' },
      { value: '$model(agree)', component: '$component(Input)' },
    ],
  },
});

describe('createJsonForm', () => {
  it('собирает model+form+schema+registry из initial (один проход)', () => {
    const jf = createJsonForm<F>({ schema, registry, initial: { email: 'a@b.c', agree: true } });
    expect(jf.model.get()).toEqual({ email: 'a@b.c', agree: true });
    expect(jf.schema).toBe(schema);
    expect(jf.registry).toBe(registry);
    expect(jf.form).toBeTruthy();
  });

  it('принимает готовую model (приоритетнее initial)', () => {
    const first = createJsonForm<F>({
      schema,
      registry,
      initial: { email: 'first@x', agree: false },
    });
    const second = createJsonForm<F>({ schema, registry, model: first.model });
    expect(second.model).toBe(first.model);
  });

  it('бросает, если не заданы ни initial, ни model', () => {
    expect(() => createJsonForm<F>({ schema, registry })).toThrow(/initial|model/i);
  });
});

describe('createJsonForm — валидация, поведение и фазы', () => {
  const emailRules = defineValidationSchema<F>(({ model }) => {
    validate(model.$.email, [required({ message: 'req' })]);
  });

  it('собирает валидацию из правил и кладёт бандл в результат', async () => {
    const jf = createJsonForm<F>({
      schema,
      registry,
      initial: { email: '', agree: false },
      validation: { steps: { account: emailRules }, strategy: 'change' },
    });
    expect(jf.validation?.stepSelectors).toEqual(['account']);
    expect(await jf.validation!.validateStep('account')).toBe(false); // email пустой
    jf.model.email = 'a@b.c';
    expect(await jf.validation!.validateAll()).toBe(true);
  });

  it('renderBehavior: фабрика зовётся один раз с формой, моделью и валидацией; результат в бандле', () => {
    const applied: RenderBehaviorFn<F> = () => {};
    const factory = vi.fn(() => applied);
    const jf = createJsonForm<F>({
      schema,
      registry,
      initial: { email: '', agree: false },
      validation: emailRules,
      renderBehavior: factory,
    });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(jf.form, jf.model, jf.validation);
    expect(jf.renderBehavior).toBe(applied);
  });

  it('без renderBehavior поле остаётся пустым (старый путь не тронут)', () => {
    const jf = createJsonForm<F>({ schema, registry, initial: { email: '', agree: false } });
    expect(jf.renderBehavior).toBeUndefined();
    expect(jf.validation).toBeUndefined();
  });

  it('seed правит модель до сборки формы, setup — после', () => {
    const order: string[] = [];
    const jf = createJsonForm<F>({
      schema,
      registry,
      initial: { email: '', agree: false },
      seed: (model) => {
        order.push('seed');
        model.email = 'seeded@x';
      },
      setup: (bundle) => {
        order.push('setup');
        expect(bundle.form.email.value.value).toBe('seeded@x');
      },
    });
    expect(order).toEqual(['seed', 'setup']);
    expect(jf.model.email).toBe('seeded@x');
  });
});
