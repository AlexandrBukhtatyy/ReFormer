/**
 * Regression tests for defect #28 и сокращённого набора затеняемых имён.
 *
 * Точкой `form.<name>` поле недостижимо, только если его имя — член контракта {@link FormNode}
 * (`value`, `issues`, `reset`, …): там член ноды. Пространство `form.$.<name>` отдаёт ноду поля
 * всегда. Прочие имена — `id`, `status`, `fields`, `submit`, внутренности класса — поля.
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { isFormControl } from '../../../src/form/type-guards';

interface ShadowedModel {
  value: string; // член FormNode — затенён
  issues: string; // член FormNode — затенён
  status: string; // не член контракта — поле
  id: string; // не член контракта — поле
  email: string;
}

function makeForm() {
  const model = createModel<ShadowedModel>({
    value: 'raw',
    issues: 'none',
    status: 'active',
    id: 'user-42',
    email: 'e@x.com',
  });
  return createFormFromModel<ShadowedModel>({ model });
}

describe('FormGroup — затенение полей членами FormNode', () => {
  it('form.<член FormNode> возвращает член ноды, а не поле', () => {
    const form = makeForm();

    // value → значение всей группы
    expect(form.value.value).toMatchObject({ email: 'e@x.com', status: 'active' });
    // issues → замечания группы
    expect(form.issues.value).toEqual([]);
    expect(typeof form.reset).toBe('function');
  });

  it('form.$ даёт доступ к затенённым полям как к настоящим нодам поля', () => {
    const form = makeForm();

    expect(isFormControl(form.$.value)).toBe(true);
    expect(form.$.value.value.value).toBe('raw');
    expect(isFormControl(form.$.issues)).toBe(true);
    expect(form.$.issues.value.value).toBe('none');
  });

  it('form.$.<field>.setValue меняет значение затенённого поля', () => {
    const form = makeForm();

    form.$.value.setValue('changed');
    expect(form.$.value.value.value).toBe('changed');
    expect(form.value.value.value).toBe('changed');
  });

  it('id, status, fields, submit — поля данных, а не члены ноды', () => {
    interface Order {
      id: string;
      status: string;
      fields: string;
      submit: string;
      items: string;
    }
    const model = createModel<Order>({
      id: 'o-1',
      status: 'new',
      fields: 'f',
      submit: 's',
      items: 'i',
    });
    const form = createFormFromModel<Order>({ model });

    for (const name of ['id', 'status', 'fields', 'submit', 'items'] as const) {
      expect(isFormControl(form[name]), name).toBe(true);
      expect(form[name]).toBe(form.$[name]);
    }
    expect(form.status.value.value).toBe('new');
    form.id.setValue('o-2');
    expect(model.id).toBe('o-2');
  });

  it('внутренние методы класса не затеняют поле данных', () => {
    interface Internals {
      dispose: string;
      children: string;
      proxy: string;
    }
    const model = createModel<Internals>({ dispose: 'd', children: 'c', proxy: 'p' });
    const form = createFormFromModel<Internals>({ model });

    expect(isFormControl(form.dispose)).toBe(true);
    expect(isFormControl(form.children)).toBe(true);
    expect(form.proxy.value.value).toBe('p');
    // Методы группы работают и при таком поле: они привязаны к классу, а не к прокси с полями.
    form.reset({ dispose: 'x', children: 'y', proxy: 'z' });
    expect(model.get()).toEqual({ dispose: 'x', children: 'y', proxy: 'z' });
    expect(form.getValue()).toEqual({ dispose: 'x', children: 'y', proxy: 'z' });
  });

  it('незатенённые поля доступны и напрямую, и через form.$', () => {
    const form = makeForm();

    expect(isFormControl(form.email)).toBe(true);
    expect(form.email.value.value).toBe('e@x.com');
    expect(form.$.email).toBe(form.email);
  });

  it("'$' виден через оператор in, поля — тоже", () => {
    const form = makeForm();
    expect('$' in form).toBe(true);
    expect('email' in form).toBe(true);
  });

  it('прямое присваивание полю запрещено', () => {
    const form = makeForm() as unknown as Record<string, unknown>;
    expect(() => {
      'use strict';
      form.email = 'x';
    }).toThrow(TypeError);
  });
});
