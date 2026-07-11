/**
 * Unit tests: FieldNode, привязанный к сигналу FormModel (M1).
 *
 * Проверяет ключевой механизм Ф3: значение принадлежит модели, нода ссылается на сигнал.
 * - двусторонняя связь node ↔ model (через valueSignal)
 * - валидация работает на инъектированном сигнале
 * - dirty (edit-tracking) и reset сохраняют семантику
 */

import { describe, it, expect } from 'vitest';
import { FieldNode } from '../../../src/form/nodes/field-node';
import { createModel } from '../../../src/state/index';
import type { ValidatorFn } from '../../../src/form/types/index';

const required: ValidatorFn<string> = (v) =>
  v === '' || v == null ? { code: 'required', message: 'Обязательно' } : null;

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

  it('валидация работает на сигнале модели', async () => {
    const model = createModel<{ email: string }>({ email: '' });
    const node = new FieldNode<string>({ valueSignal: model.$.email, validators: [required] });
    await node.validate();
    expect(node.invalid.value).toBe(true);
    node.setValue('ok@mail.com');
    await node.validate();
    expect(node.valid.value).toBe(true);
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
    const node = new FieldNode<number>({ valueSignal: model.$.age, validators: [] });
    expect(node.component).toBeUndefined();
    node.setValue(42);
    expect(model.age).toBe(42);
  });
});
