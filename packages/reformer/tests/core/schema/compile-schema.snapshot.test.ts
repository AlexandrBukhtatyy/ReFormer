/**
 * Снапшоты скомпилированной схемы на характерных деревьях: плоская форма, визард с шагами, одна
 * подформа на два адреса, массив под-форм с подформой в строке.
 *
 * Компиляцию читают сборка формы, рендереры и инструменты; снапшот ловит любое изменение её формы:
 * вид узлов, идентификаторы, области, индексы полей и массивов, склейку текста. Описание строит
 * `describeCompiled` (`test-utils/compiled-snapshot`): без живых ссылок и с нормализованными
 * ключами строк, поэтому снапшот не зависит от порядка запуска тестов (`--sequence.shuffle`).
 * Обновление снапшотов — `npx vitest run -u tests/core/schema/compile-schema.snapshot.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { signal } from '@preact/signals-core';
import {
  CheckboxStub,
  FieldArrayStub,
  InputStub,
  SectionStub,
  SelectStub,
  StepStub,
  WizardStub,
} from '../../test-utils/stubs';
import { describeCompiled, type DescribedNode } from '../../test-utils/compiled-snapshot';
import { compileSchema } from '../../../src/form/schema/compile';
import { rowKeyOf } from '../../../src/form/schema/row-key';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

interface Address {
  city: string;
  street: string;
}
interface Phone {
  number: string;
  address: Address;
}

const blankAddress = (): Address => ({ city: '', street: '' });

/** Одна часть на любую группу-адрес: селекторы внутри живут в области части. */
const addressPart = (model: FormModel<Address>): FormSchemaNode => ({
  selector: 'address',
  component: SectionStub,
  children: [
    {
      selector: 'city',
      model: model.$.city,
      component: InputStub,
      componentProps: { label: 'Город' },
    },
    { model: model.$.street, component: InputStub, componentProps: { label: 'Улица' } },
  ],
});

const phoneRow = (row: FormModel<Phone>): FormSchemaNode => ({
  selector: 'row',
  component: SectionStub,
  children: [
    { selector: 'number', model: row.$.number, component: InputStub },
    { selector: 'address', model: row.$.address, part: addressPart },
  ],
});

/** Массив под-форм с подформой в строке — общий для снапшота и проверок нормализации. */
const createPhones = () => {
  const model = createModel<{ owner: string; phones: Phone[] }>({
    owner: '',
    phones: arrayOf(
      (): Phone => ({ number: '', address: blankAddress() }),
      [
        { number: '111', address: { city: 'Казань', street: 'Баумана' } },
        { number: '222', address: { city: 'Самара', street: 'Ленина' } },
      ]
    ),
  });
  const tree: FormSchemaNode = {
    children: [
      { model: model.$.owner, component: InputStub, componentProps: { label: 'Владелец' } },
      {
        selector: 'phones',
        model: model.$.phones,
        component: FieldArrayStub,
        componentProps: { addLabel: 'Добавить телефон' },
        item: phoneRow,
        initialValue: { number: '', address: blankAddress() },
      },
    ],
  };
  return { model, tree };
};

/** Узел-массив в описании корня (первый ребёнок вида `array`). */
const describedArray = (root: DescribedNode): DescribedNode =>
  (root.children as DescribedNode[]).find((child) => child.kind === 'array')!;

describe('compileSchema — снапшоты характерных деревьев', () => {
  it('плоская форма: поля, текст из строк, чисел и сигнала, HTML-тег, пропсы с функцией', () => {
    const model = createModel({ name: '', age: 0, agree: false, tags: [] as string[], city: '' });
    const hint = signal('Как в паспорте');
    const tree: FormSchemaNode = {
      selector: 'form',
      component: SectionStub,
      componentProps: { title: 'Анкета', onSubmit: () => undefined },
      children: [
        'Шаг ',
        1,
        ' из ',
        3,
        { selector: 'name', model: model.$.name, component: InputStub, componentProps: { hint } },
        { model: model.$.age, component: InputStub, componentProps: { label: 'Возраст', min: 18 } },
        { model: model.$.agree, component: CheckboxStub, disabled: true },
        { model: model.$.tags, component: SelectStub, componentProps: { options: ['a', 'b'] } },
        { component: 'hr' },
        'Город: ',
        model.$.city,
      ],
    };

    expect(describeCompiled(compileSchema(tree, model))).toMatchSnapshot();
  });

  it('визард: шаги — контейнеры с selector, поля вложенных групп привязаны напрямую', () => {
    const model = createModel({
      loan: { amount: 0, term: 12 },
      contacts: { email: '', phone: '' },
      confirm: false,
    });
    const tree: FormSchemaNode = {
      selector: 'wizard',
      component: WizardStub,
      children: [
        {
          selector: 'loan',
          component: StepStub,
          componentProps: { title: 'Кредит' },
          children: [
            { model: model.$.loan.amount, component: InputStub },
            { model: model.$.loan.term, component: SelectStub },
          ],
        },
        {
          selector: 'contacts',
          component: StepStub,
          componentProps: { title: 'Контакты' },
          children: [
            { selector: 'email', model: model.$.contacts.email, component: InputStub },
            { model: model.$.contacts.phone, component: InputStub },
          ],
        },
        {
          selector: 'confirm',
          component: StepStub,
          children: ['Проверьте данные', { model: model.$.confirm, component: CheckboxStub }],
        },
      ],
    };

    expect(describeCompiled(compileSchema(tree, model))).toMatchSnapshot();
  });

  it('одна подформа на два адреса: две области, поля обеих — в индексе корня', () => {
    const model = createModel({
      name: '',
      registration: blankAddress(),
      residence: blankAddress(),
    });
    const tree: FormSchemaNode = {
      children: [
        { model: model.$.name, component: InputStub },
        { selector: 'registration', model: model.$.registration, part: addressPart },
        {
          selector: 'residence',
          model: model.$.residence,
          part: addressPart,
          componentProps: { title: 'Фактический адрес' },
        },
      ],
    };

    expect(describeCompiled(compileSchema(tree, model))).toMatchSnapshot();
  });

  it('массив под-форм: строки со своей областью и подформой в строке', () => {
    const { model, tree } = createPhones();

    expect(describeCompiled(compileSchema(tree, model))).toMatchSnapshot();
  });
});

describe('describeCompiled — нормализация ключей строк', () => {
  it('описание не зависит от того, сколько ключей строк выдано до него', () => {
    const first = createPhones();
    const before = describeCompiled(compileSchema(first.tree, first.model));
    // Сдвинуть глобальный счётчик ключей: так ведут себя тесты, запущенные раньше.
    for (let index = 0; index < 5; index++) rowKeyOf({});
    const second = createPhones();

    expect(describeCompiled(compileSchema(second.tree, second.model))).toEqual(before);
  });

  it('после move ключ остаётся за строкой: строки идут в новом порядке со старыми ключами', () => {
    const { model, tree } = createPhones();
    const compiled = compileSchema(tree, model);
    const scopesOf = () =>
      (describedArray(describeCompiled(compiled).root).rows as { scope: string }[]).map(
        (row) => row.scope
      );
    expect(scopesOf()).toEqual(['#/phones[row#0]', '#/phones[row#1]']);

    model.phones.move(0, 1);

    expect(scopesOf()).toEqual(['#/phones[row#1]', '#/phones[row#0]']);
  });

  it('без строк: `rows: false` не компилирует строки и не описывает их', () => {
    const { model } = createPhones();
    let calls = 0;
    const counted: FormSchemaNode = {
      children: [
        {
          model: model.$.phones,
          item: (row: FormModel<Phone>) => {
            calls += 1;
            return phoneRow(row);
          },
        },
      ],
    };

    const described = describeCompiled(compileSchema(counted, model), { rows: false });

    expect(describedArray(described.root)).not.toHaveProperty('rows');
    expect(calls).toBe(0);
  });
});
