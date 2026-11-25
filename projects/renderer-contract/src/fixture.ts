/**
 * Форма-образец сценариев: поле, две подформы одной части, массив строк.
 *
 * @module renderer-contract/fixture
 */

import { arrayOf, createModel } from '@reformer/core';
import type { FormModel, FormSchemaNode } from '@reformer/core';
import type { ContractKit } from './adapter';

export interface Address {
  city: string;
  street: string;
}

export interface Row {
  name: string;
  note: string;
}

export interface Shape {
  kind: string;
  agree: boolean;
  tags: string[];
  registration: Address;
  residence: Address;
  rows: Row[];
}

/** Шаблон новой строки массива. */
export const blankRow = (): Row => ({ name: '', note: '' });

/** Модель образца: адрес регистрации — Казань, проживания — Москва, строки «первый» и «второй». */
export function createShape(over: Partial<Shape> = {}): FormModel<Shape> {
  return createModel<Shape>({
    kind: 'a',
    agree: false,
    tags: ['ru', 'by'],
    registration: { city: 'Казань', street: '' },
    residence: { city: 'Москва', street: '' },
    rows: arrayOf(blankRow, [
      { name: 'первый', note: '' },
      { name: 'второй', note: '' },
    ]),
    ...over,
  });
}

/** Схемы образца на компонентах кита. */
export interface Fixture {
  /** Часть «адрес»: город и секция с селектором `street` вокруг улицы. */
  address(model: FormModel<Address>): FormSchemaNode;
  /** Строка массива: имя и секция с селектором `note` вокруг заметки. */
  row(model: FormModel<Row>): FormSchemaNode;
  /**
   * Вся форма: секция `root` — поле `kind`, секции `registration` и `residence` с частью «адрес»,
   * массив строк.
   */
  shapeSchema(model: FormModel<Shape>): FormSchemaNode;
}

/** Схемы образца на компонентах кита стека. */
export function createFixture(kit: ContractKit): Fixture {
  const { Input, List, Section } = kit;

  const address = (model: FormModel<Address>): FormSchemaNode => ({
    component: Section,
    children: [
      { model: model.$.city, component: Input, componentProps: { caption: 'Город' } },
      {
        selector: 'street',
        component: Section,
        componentProps: { title: 'улица' },
        children: [
          { model: model.$.street, component: Input, componentProps: { caption: 'Улица' } },
        ],
      },
    ],
  });

  const row = (model: FormModel<Row>): FormSchemaNode => ({
    component: Section,
    children: [
      { model: model.$.name, component: Input, componentProps: { caption: 'Имя' } },
      {
        selector: 'note',
        component: Section,
        componentProps: { title: 'заметка' },
        children: [
          { model: model.$.note, component: Input, componentProps: { caption: 'Заметка' } },
        ],
      },
    ],
  });

  const shapeSchema = (model: FormModel<Shape>): FormSchemaNode => ({
    selector: 'root',
    component: Section,
    children: [
      { model: model.$.kind, component: Input, componentProps: { caption: 'Вид' } },
      {
        selector: 'registration',
        component: Section,
        componentProps: { title: 'регистрация' },
        children: [{ model: model.$.registration, part: address }],
      },
      {
        selector: 'residence',
        component: Section,
        componentProps: { title: 'проживание' },
        children: [{ model: model.$.residence, part: address }],
      },
      { model: model.$.rows, component: List, item: row },
    ],
  });

  return { address, row, shapeSchema };
}
