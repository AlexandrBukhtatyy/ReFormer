/**
 * Реестр «ручка модели → нода формы» (`registerSignalNode` / `getNodeForSignal`).
 *
 * По реестру раннер валидации разносит замечания, поведение находит ноды для `enableWhen`, а
 * `apply`/`applyEach` — формы под-моделей. Ключ — идентичность ручки дерева `model.$`, а не путь.
 * Здесь: что регистрирует сборка (поле, лицо группы, массив, строка, корень), что не
 * регистрируется, перепривязка ручки к ноде другой сборки и разнос замечаний в неё.
 */

import { describe, expect, it } from 'vitest';
import { arrayOf, createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/types';
import { createFormFromModel } from '../../../src/form/create-form';
import { getNodeForSignal, registerSignalNode } from '../../../src/form/signal-node-registry';
import { defineValidation, validate, validateModel } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import { fieldOf } from '../../test-utils/form-from-fields';
import { issueCodes } from '../../test-utils/issues';

interface Phone {
  number: string;
}

interface Person {
  email: string;
  address: { city: string };
  phones: Phone[];
  tags: string[];
}

const createPerson = () => {
  const model = createModel<Person>({
    email: '',
    address: { city: '' },
    phones: arrayOf(() => ({ number: '' }), [{ number: '1' }, { number: '2' }]),
    tags: ['a'],
  });
  const form = createFormFromModel<Person>({
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

describe('signal-node-registry — что регистрирует сборка', () => {
  it('поле, лицо группы, массив, строку массива, поле строки и корень', () => {
    const { model, form } = createPerson();

    expect(getNodeForSignal(model.$.email)).toBe(form.email);
    expect(getNodeForSignal(model.$.address)).toBe(form.address);
    expect(getNodeForSignal(model.$.address.city)).toBe(form.address.city);
    expect(getNodeForSignal(model.$.phones)).toBe(form.phones);
    expect(getNodeForSignal(model.$.phones[1])).toBe(form.phones.at(1));
    expect(getNodeForSignal(model.$.phones[1].number)).toBe(form.phones.at(1)?.number);
    expect(getNodeForSignal(model.$)).toBe(form);
  });

  it('строка, добавленная после сборки, тоже попадает в реестр', () => {
    const { model, form } = createPerson();

    form.phones.push({ number: '3' });

    expect(getNodeForSignal(model.$.phones[2])).toBe(form.phones.at(2));
  });

  it('ручка строки — идентичность под-модели: после move ведёт к той же форме строки', () => {
    const { model, form } = createPerson();
    const handle = model.$.phones[0];
    const row = form.phones.at(0);

    form.phones.move(0, 1);

    expect(model.$.phones[1]).toBe(handle);
    expect(getNodeForSignal(handle)).toBe(row);
    expect(form.phones.at(1)).toBe(row);
  });

  it('без сборки, массив без item и чужой объект — undefined', () => {
    const model = createModel({ email: '', tags: ['a'] });
    expect(getNodeForSignal(model.$.email)).toBeUndefined();

    createFormFromModel({ model });

    expect(getNodeForSignal(model.$.email)).toBeDefined();
    expect(getNodeForSignal(model.$.tags)).toBeUndefined();
    expect(getNodeForSignal({})).toBeUndefined();
  });
});

describe('signal-node-registry — перепривязка', () => {
  it('ключ — любой объект: ручкой служит идентичность', () => {
    const handle = {};
    const node = fieldOf('x');

    registerSignalNode(handle, node);

    expect(getNodeForSignal(handle)).toBe(node);
    expect(getNodeForSignal({})).toBeUndefined();
  });

  it('повторная сборка над той же моделью перехватывает ручки; регистрация возвращает их', () => {
    const model = createModel({ email: '' });
    const first = createFormFromModel({ model });
    const second = createFormFromModel({ model });
    expect(getNodeForSignal(model.$.email)).toBe(second.email);

    registerSignalNode(model.$.email, first.email);

    expect(getNodeForSignal(model.$.email)).toBe(first.email);
  });

  it('раннер разносит замечания в ноду другой сборки, к которой привязана ручка, и гасит их', async () => {
    interface Account {
      profile: { email: string };
    }
    const model = createModel<Account>({ profile: { email: '' } });
    const form = createFormFromModel<Account>({ model });
    const profileForm = createFormFromModel({ model: createModel({ email: '' }) });
    registerSignalNode(model.$.profile.email, profileForm.email);
    const rules = defineValidation<Account>(({ model: account }) => {
      validate(account.$.profile.email, [required()]);
    });

    expect(await validateModel(model, rules)).toBe(false);
    expect(issueCodes(profileForm.email)).toEqual(['required']);
    expect(form.profile.email.issues.value).toEqual([]);

    model.profile.email = 'neo@zion.io';
    expect(await validateModel(model, rules)).toBe(true);
    expect(profileForm.email.issues.value).toEqual([]);
  });
});
