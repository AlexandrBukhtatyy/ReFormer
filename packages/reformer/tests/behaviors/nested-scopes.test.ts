/**
 * Вложенные области: массив в группе, массив в строке массива, под-схемы внутри под-схем.
 *
 * Цель операторов — ручка дерева `model.$`. Под-модель и нода формы находятся по идентичности
 * ручки, а не по пути. Раньше поиск шёл по пути: путь ручки абсолютный (`contacts.0.phones`), а
 * область строки — отдельный корень, поэтому операторы в схеме строки молча ничего не делали.
 */

import { describe, it, expect } from 'vitest';
import { createModel, type FormModel } from '../../src/model/index';
import { createFormFromModel } from '../../src/form/create-form';
import { getNodeForSignal } from '../../src/form/signal-node-registry';
import {
  defineFormBehavior,
  aggregateInto,
  apply,
  applyEach,
  compute,
  enableWhen,
  exclusiveFlag,
  onChange,
} from '../../src/form/behaviors';
import type { FormProxy } from '../../src/form/types/index';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

interface Phone {
  number: string;
  primary: boolean;
}
interface Address {
  city: string;
  street: string;
}
interface Contact {
  name: string;
  quantity: number;
  share: number;
  address: Address;
  phones: Phone[];
}
interface Shape {
  title: string;
  details: { note: string; hotlines: Phone[] };
  contacts: Contact[];
}

const blankContact = (name: string, phones: Phone[] = []): Contact => ({
  name,
  quantity: 0,
  share: 0,
  address: { city: '', street: '' },
  phones,
});

const createShape = () =>
  createModel<Shape>({ title: '', details: { note: '', hotlines: [] }, contacts: [] });

const phoneItem = (phone: FormModel<Phone>) => ({
  children: [{ model: phone.$.number }, { model: phone.$.primary }],
});
const contactItem = (contact: FormModel<Contact>) => ({
  children: [
    { model: contact.$.name },
    { model: contact.$.quantity },
    { model: contact.$.share },
    { model: contact.$.address.city },
    { model: contact.$.address.street },
    { model: contact.$.phones, item: phoneItem }, // массив в строке массива
  ],
});
const buildSchema = (model: FormModel<Shape>) => ({
  children: [
    { model: model.$.title },
    { model: model.$.details.note },
    { model: model.$.details.hotlines, item: phoneItem }, // массив в группе
    { model: model.$.contacts, item: contactItem },
  ],
});

// Доступ к нодам без полной типизации прокси массивов.
interface FieldLike {
  disabled: { value: boolean };
  setValue(value: unknown): void;
  componentProps: { value: Record<string, unknown> };
}
interface ArrayLike<Row> {
  length: { value: number };
  at(index: number): Row;
}
interface PhoneRow {
  number: FieldLike;
  primary: FieldLike;
}
interface ContactRow {
  name: FieldLike;
  address: { city: FieldLike; street: FieldLike };
  phones: ArrayLike<PhoneRow>;
}
const contactsOf = (form: FormProxy<Shape>) => form.contacts as unknown as ArrayLike<ContactRow>;
const hotlinesOf = (form: FormProxy<Shape>) =>
  (form.details as unknown as { hotlines: ArrayLike<PhoneRow> }).hotlines;

describe('Вложенные массивы материализуются на любой глубине', () => {
  it('массив в группе получает ноду и формы строк', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({ model, schema: buildSchema(model) });

    model.details.hotlines.push({ number: '', primary: false });

    expect(hotlinesOf(form).length.value).toBe(1);
    hotlinesOf(form).at(0).number.setValue('8-800');
    expect(model.get().details.hotlines[0].number).toBe('8-800');
  });

  it('массив в строке массива получает ноду и формы строк', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({ model, schema: buildSchema(model) });

    model.contacts.push(blankContact('Анна', [{ number: '', primary: false }]));

    const phones = contactsOf(form).at(0).phones;
    expect(phones.length.value).toBe(1);
    phones.at(0).number.setValue('+7');
    expect(model.get().contacts[0].phones[0].number).toBe('+7');

    // строка, добавленная позже, тоже получает форму
    model.contacts.at(0).phones.push({ number: '112', primary: false });
    expect(phones.length.value).toBe(2);
  });

  it('группа, массив и строка находятся в реестре по своей ручке', () => {
    const model = createShape();
    const form = createFormFromModel<Shape>({ model, schema: buildSchema(model) });
    model.contacts.push(blankContact('Анна'));

    expect(getNodeForSignal(model.$ as object)).toBeDefined();
    expect(getNodeForSignal(model.$.details)).toBeDefined();
    expect(getNodeForSignal(model.$.contacts)).toBeDefined();
    expect(getNodeForSignal(model.$.details.hotlines)).toBeDefined();
    // строка массива — корень своей формы
    expect(getNodeForSignal(model.$.contacts[0])).toBeDefined();
    expect(getNodeForSignal(model.$.contacts[0].address)).toBeDefined();
    expect(form).toBeDefined();
  });
});

describe('Под-схемы во вложенных областях', () => {
  it('applyEach внутри applyEach: поведение строки вложенного массива', async () => {
    const model = createShape();
    const phoneBehavior = defineFormBehavior<Phone>(({ model: phone }) => {
      enableWhen(phone.$.number, () => phone.primary); // node-операция в строке вложенного массива
    });
    const contactBehavior = defineFormBehavior<Contact>(({ model: contact }) => {
      applyEach(contact.$.phones, phoneBehavior);
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      applyEach(root.$.contacts, contactBehavior);
    });
    const form = createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    model.contacts.push(blankContact('Анна', [{ number: '', primary: false }]));
    await tick();
    const phoneRow = contactsOf(form).at(0).phones.at(0);
    expect(phoneRow.number.disabled.value).toBe(true);

    model.contacts.at(0).phones.at(0).primary = true;
    await tick();
    expect(phoneRow.number.disabled.value).toBe(false);
  });

  it('enableWhen группы внутри строки массива', async () => {
    const model = createShape();
    const contactBehavior = defineFormBehavior<Contact>(({ model: contact }) => {
      enableWhen(contact.$.address, () => contact.quantity > 0);
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      applyEach(root.$.contacts, contactBehavior);
    });
    const form = createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    model.contacts.push(blankContact('Анна'));
    await tick();
    const row = contactsOf(form).at(0);
    expect(row.address.city.disabled.value).toBe(true);
    expect(row.address.street.disabled.value).toBe(true);

    model.contacts.at(0).quantity = 2;
    await tick();
    expect(row.address.city.disabled.value).toBe(false);
  });

  it('apply внутри строки: под-схема получает настоящую под-модель и ноду группы', async () => {
    const model = createShape();
    const seen: Array<{ snapshot: Address; hasStreetNode: boolean }> = [];
    const addressBehavior = defineFormBehavior<Address>(({ model: address, form: addressForm }) => {
      const streetNode = (addressForm as unknown as { street?: FieldLike }).street;
      seen.push({
        snapshot: address.get(), // у настоящей под-модели есть get/set/patch
        hasStreetNode: typeof streetNode?.setValue === 'function',
      });
      onChange(address.$.city, (city) => {
        address.patch({ street: city ? `${city}, центр` : '' });
      });
    });
    const contactBehavior = defineFormBehavior<Contact>(({ model: contact }) => {
      apply(contact.$.address, addressBehavior);
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      applyEach(root.$.contacts, contactBehavior);
    });
    createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    model.contacts.push(blankContact('Анна'));
    await tick();
    expect(seen).toEqual([{ snapshot: { city: '', street: '' }, hasStreetNode: true }]);

    model.contacts.at(0).address.city = 'Казань';
    await tick();
    expect(model.get().contacts[0].address.street).toBe('Казань, центр');
  });

  it('apply к группе с массивом: в под-схеме работает applyEach', async () => {
    const model = createShape();
    const phoneBehavior = defineFormBehavior<Phone>(({ model: phone }) => {
      compute(phone.$.number, () => (phone.primary ? 'основной' : 'запасной'));
    });
    const detailsBehavior = defineFormBehavior<Shape['details']>(({ model: details }) => {
      applyEach(details.$.hotlines, phoneBehavior);
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      apply(root.$.details, detailsBehavior);
    });
    createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    model.details.hotlines.push({ number: '', primary: true });
    await tick();
    expect(model.get().details.hotlines[0].number).toBe('основной');
  });

  it('apply к корневой ручке запускает под-схему на самой модели', () => {
    const model = createShape();
    const titles: unknown[] = [];
    const rootPart = defineFormBehavior<Shape>(({ model: same, form }) => {
      titles.push(same === model, form != null);
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      apply(root.$, rootPart);
    });
    createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    expect(titles).toEqual([true, true]);
  });

  it('exclusiveFlag в схеме строки: единственный основной телефон у контакта', async () => {
    const model = createShape();
    const contactBehavior = defineFormBehavior<Contact>(({ model: contact }) => {
      exclusiveFlag<Phone>(contact.$.phones, (phone) => phone.$.primary);
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      applyEach(root.$.contacts, contactBehavior);
    });
    createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    model.contacts.push(
      blankContact('Анна', [
        { number: '1', primary: true },
        { number: '2', primary: false },
      ])
    );
    await tick();
    model.contacts.at(0).phones.at(1).primary = true;
    await tick();

    expect(model.get().contacts[0].phones.map((phone) => phone.primary)).toEqual([false, true]);
  });

  it('aggregateInto в схеме группы', async () => {
    const model = createShape();
    const detailsBehavior = defineFormBehavior<Shape['details']>(({ model: details }) => {
      // последняя «горячая линия» всегда основная
      aggregateInto<Phone>(details.$.hotlines, (rows) =>
        rows.map((_row, index) => ({ index, patch: { primary: index === rows.length - 1 } }))
      );
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      apply(root.$.details, detailsBehavior);
    });
    createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    model.details.hotlines.push({ number: '1', primary: false });
    model.details.hotlines.push({ number: '2', primary: false });
    await tick();
    await tick();

    expect(model.get().details.hotlines.map((phone) => phone.primary)).toEqual([false, true]);
  });
});

describe('Перестановка строк не ломает привязку', () => {
  it('поведение строки не перезапускается и остаётся со своей строкой', async () => {
    const model = createShape();
    let runs = 0;
    const contactBehavior = defineFormBehavior<Contact>(({ model: contact }) => {
      runs += 1;
      enableWhen(contact.$.address, () => contact.quantity > 0);
    });
    const behavior = defineFormBehavior<Shape>(({ model: root }) => {
      applyEach(root.$.contacts, contactBehavior);
    });
    const form = createFormFromModel<Shape>({ model, schema: buildSchema(model), behavior });

    model.contacts.push(blankContact('Анна'));
    model.contacts.push(blankContact('Борис'));
    await tick();
    expect(runs).toBe(2);

    const anna = model.contacts.at(0);
    model.contacts.move(0, 1);
    await tick();
    expect(runs).toBe(2); // перестановка поведение не перезапускает
    expect(model.contacts.at(1)).toBe(anna);

    anna.quantity = 3; // строка переехала на индекс 1 — её правило по-прежнему действует на неё
    await tick();
    expect(contactsOf(form).at(1).address.city.disabled.value).toBe(false);
    expect(contactsOf(form).at(0).address.city.disabled.value).toBe(true);
  });
});
