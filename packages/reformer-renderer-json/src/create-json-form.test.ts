import { describe, it, expect } from 'vitest';
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
