/**
 * Метка вида ноды (`kindOf`) и сырой узел за прокси группы (`rawNode`).
 *
 * На метке держатся гарды `isFormControl`/`isFormGroup`/`isFormArray`, на `rawNode` — внутренние
 * вызовы сборки, раннера и массива строк (им нужен класс группы, а не лицо с полями). Метки —
 * символы реестра `Symbol.for`: нода, построенная независимо загруженной копией ядра (дубликат
 * пакета в бандле), распознаётся гардами и `rawNode` этой копии. Здесь это проверяется на
 * настоящей второй копии модулей (`vi.resetModules` + динамический импорт).
 */

import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { NODE_KIND, RAW_NODE, kindOf, rawNode } from '../../../src/form/nodes/node-kind';
import { FormControlNode } from '../../../src/form/nodes/form-control-node';
import { FormGroupNode } from '../../../src/form/nodes/form-group-node';
import { arrayOf, createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { createFormFromModel } from '../../../src/form/create-form';
import { isFormControl, isFormGroup } from '../../../src/form/type-guards';
import { fieldOf } from '../../test-utils/form-from-fields';

interface Phone {
  number: string;
}

const createContacts = () => {
  const model = createModel({
    email: '',
    phones: arrayOf(() => ({ number: '' }), [{ number: '1' }]),
  });
  const form = createFormFromModel({
    model,
    schema: {
      children: [
        {
          model: model.$.phones,
          item: (row: FormModel<Phone>) => ({ children: [{ model: row.$.number }] }),
        },
      ],
    },
  });
  return { model, form };
};

describe('node-kind — kindOf', () => {
  it.each<[string, unknown]>([
    ['число', 0],
    ['NaN', NaN],
    ['строка с именем вида', 'control'],
    ['пустая строка', ''],
    ['boolean', true],
    ['символ', Symbol('control')],
    ['bigint', 1n],
    ['undefined', undefined],
    ['null', null],
  ])('%s — не нода', (_label, value) => {
    expect(kindOf(value)).toBeUndefined();
  });

  it('функция с меткой — не нода: вид читается только у объектов', () => {
    const fn = Object.assign(() => null, { [NODE_KIND]: 'control' });

    expect(kindOf(fn)).toBeUndefined();
  });

  it('чужой объект: вид — только по метке и только из трёх известных', () => {
    expect(kindOf({ [NODE_KIND]: 'control' })).toBe('control');
    expect(kindOf({ [NODE_KIND]: 'group' })).toBe('group');
    expect(kindOf({ [NODE_KIND]: 'array' })).toBe('array');
    expect(kindOf({ [NODE_KIND]: 'Control' })).toBeUndefined();
    expect(kindOf({ [NODE_KIND]: undefined })).toBeUndefined();
    expect(kindOf({ kind: 'control', value: signal('') })).toBeUndefined();
    expect(kindOf([])).toBeUndefined();
  });

  it('настоящие ноды: поле, группа (лицо и класс), массив и строка массива', () => {
    const { form } = createContacts();

    expect(kindOf(form.email)).toBe('control');
    expect(kindOf(form)).toBe('group');
    expect(kindOf(rawNode(form))).toBe('group');
    expect(kindOf(form.phones)).toBe('array');
    expect(kindOf(form.phones.at(0))).toBe('group');
  });
});

describe('node-kind — rawNode', () => {
  it('у лица группы — её класс: другой объект, без полей по именам, с тем же лицом', () => {
    const { form } = createContacts();

    const raw = rawNode(form);

    expect(raw).not.toBe(form);
    expect(raw).toBeInstanceOf(FormGroupNode);
    expect('email' in raw).toBe(false);
    expect((raw as unknown as FormGroupNode<unknown>).proxy).toBe(form);
  });

  it('у поля, массива и самого класса группы — сама нода', () => {
    const { form } = createContacts();
    const field = fieldOf('x');
    const raw = rawNode(form);

    expect(rawNode(field)).toBe(field);
    expect(rawNode(form.email)).toBe(form.email);
    expect(rawNode(form.phones)).toBe(form.phones);
    expect(rawNode(raw)).toBe(raw);
  });

  it('у объекта без метки — сам объект', () => {
    const plain = { value: 1 };

    expect(rawNode(plain)).toBe(plain);
  });

  it('сырой узел ищется по метке реестра Symbol.for — у любого объекта с ней', () => {
    const target = { [NODE_KIND]: 'group' };
    const face = { [Symbol.for('@reformer/core/form-node-raw')]: target };

    expect(rawNode(face)).toBe(target);
  });
});

describe('node-kind — две копии ядра в одном приложении', () => {
  it('метки — общие символы реестра Symbol.for', () => {
    expect(NODE_KIND).toBe(Symbol.for('@reformer/core/form-node-kind'));
    expect(RAW_NODE).toBe(Symbol.for('@reformer/core/form-node-raw'));
  });

  it('ноду независимо загруженной копии узнают kindOf, гарды и rawNode этой копии', async () => {
    vi.resetModules();
    const copy = {
      control: await import('../../../src/form/nodes/form-control-node'),
      model: await import('../../../src/model/index'),
      form: await import('../../../src/form/create-form'),
    };
    expect(copy.control.FormControlNode).not.toBe(FormControlNode);

    const foreignField = new copy.control.FormControlNode({ valueSignal: signal('x') });
    const foreignForm = copy.form.createFormFromModel({
      model: copy.model.createModel({ email: '' }),
    });

    expect(kindOf(foreignField)).toBe('control');
    expect(isFormControl(foreignField)).toBe(true);
    expect(isFormGroup(foreignForm)).toBe(true);
    expect(rawNode(foreignForm)).not.toBe(foreignForm);
    expect(kindOf(rawNode(foreignForm))).toBe('group');
  });
});
