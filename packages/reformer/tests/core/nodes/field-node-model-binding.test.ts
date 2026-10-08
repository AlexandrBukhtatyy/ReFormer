/**
 * Unit tests: FieldNode, привязанный к сигналу FormModel (M1).
 *
 * Проверяет ключевой механизм Ф3: значение принадлежит модели, нода ссылается на сигнал.
 * - двусторонняя связь node ↔ model (через valueSignal)
 * - ошибки схемы валидации приходят на ноду по её сигналу
 * - dirty (edit-tracking) и reset сохраняют семантику
 */

import { describe, it, expect } from 'vitest';
import { FieldNode } from '../../../src/form/nodes/field-node';
import { createFormFromModel } from '../../../src/form/create-form';
import { createModel } from '../../../src/model/index';
import { defineValidationSchema, validate, validateModel } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';

describe('FieldNode + FormModel binding (M1)', () => {
  it('value ноды читается из сигнала модели', () => {
    const model = createModel<{ email: string }>({ email: 'a@b.c' });
    const node = new FieldNode<string>({ valueSignal: model.$.email });
    expect(node.value.value).toBe('a@b.c');
  });

  it('node.setValue пишет в модель (двусторонняя связь)', () => {
    const model = createModel<{ email: string }>({ email: '' });
    const node = new FieldNode<string>({ valueSignal: model.$.email });
    node.setValue('new@mail.com');
    expect(model.email).toBe('new@mail.com');
    expect(model.$.email.value).toBe('new@mail.com');
  });

  it('изменение модели отражается в node.value', () => {
    const model = createModel<{ email: string }>({ email: '' });
    const node = new FieldNode<string>({ valueSignal: model.$.email });
    model.email = 'from-model@mail.com';
    expect(node.value.value).toBe('from-model@mail.com');
  });

  it('ошибки схемы валидации приходят на ноду по сигналу модели', async () => {
    const model = createModel<{ email: string }>({ email: '' });
    const form = createFormFromModel({ model });
    const rules = defineValidationSchema<{ email: string }>(({ model: scope }) => {
      validate(scope.$.email, [required({ message: 'Обязательно' })]);
    });

    await validateModel(model, rules);
    expect(form.email.invalid.value).toBe(true);
    await expect(form.email.validate()).resolves.toBe(false);

    form.email.setValue('ok@mail.com');
    await validateModel(model, rules);
    expect(form.email.valid.value).toBe(true);
    await expect(form.email.validate()).resolves.toBe(true);
  });

  it('dirty: false изначально, true после setValue', () => {
    const model = createModel<{ email: string }>({ email: '' });
    const node = new FieldNode<string>({ valueSignal: model.$.email });
    expect(node.dirty.value).toBe(false);
    node.setValue('x@y.z');
    expect(node.dirty.value).toBe(true);
  });

  it('reset возвращает значение к initial (снимку на момент построения) и пишет в модель', () => {
    const model = createModel<{ email: string }>({ email: 'initial@mail.com' });
    const node = new FieldNode<string>({ valueSignal: model.$.email });
    node.setValue('changed@mail.com');
    expect(model.email).toBe('changed@mail.com');
    node.reset();
    expect(node.value.value).toBe('initial@mail.com');
    expect(model.email).toBe('initial@mail.com');
    expect(node.dirty.value).toBe(false);
  });

  it('вложенное поле модели', () => {
    const model = createModel<{ profile: { name: string } }>({ profile: { name: '' } });
    const node = new FieldNode<string>({ valueSignal: model.$.profile.name });
    node.setValue('Иван');
    expect(model.get().profile.name).toBe('Иван');
  });

  it('component опционален (core без UI)', () => {
    const model = createModel<{ age: number }>({ age: 0 });
    const node = new FieldNode<number>({ valueSignal: model.$.age });
    expect(node.component).toBeUndefined();
    node.setValue(42);
    expect(model.age).toBe(42);
  });
});
