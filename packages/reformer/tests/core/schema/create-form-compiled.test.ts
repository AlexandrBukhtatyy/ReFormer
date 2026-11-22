/**
 * Сборка нод формы из скомпилированной схемы: что нода берёт из компиляции и откуда.
 *
 * Компиляция отдаёт сборке индексы «ручка → поле» и «ручка → массив под-форм» области вместе с её
 * подформами, а формы строк собираются из `row()` той же компиляции. Здесь закреплено, откуда
 * приходит конфиг ноды: чего нет в компиляции (лист вне схемы, массив без `item`, сборка без
 * схемы), одна ручка в двух полях схемы, `part` на ручке массива, поле над массивом внутри
 * подформы и запасной шаблон строки (`initialValue`) у массивов в подформе и в строке другого
 * массива.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { InputStub, SectionStub, SelectStub } from '../../test-utils/stubs';
import { createFormFromModel } from '../../../src/form/create-form';
import { getNodeForSignal } from '../../../src/form/signal-node-registry';
import { createModel, type FormModel } from '../../../src/model/index';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

interface Phone {
  number: string;
}

const phoneItem = (phone: FormModel<Phone>): FormSchemaNode => ({
  model: phone.$.number,
  component: InputStub,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createFormFromModel — чего нет в компиляции', () => {
  it('лист вне схемы — нода без конфига; массив без `item` и без поля — не материализуется', () => {
    interface Shape {
      email: string;
      note: string;
      phones: Phone[];
    }
    const model = createModel<Shape>({ email: '', note: '', phones: [] });

    const form = createFormFromModel<Shape>({
      model,
      schema: { children: [{ model: model.$.email, component: InputStub }] },
    });

    expect(form.email.component).toBe(InputStub);
    expect(form.note.component).toBeUndefined();
    expect(form.note.componentProps.value).toEqual({});
    expect((form as unknown as Record<string, unknown>).phones).toBeUndefined();
  });

  it('без схемы компиляции нет: ноды строятся по модели, все без конфига', () => {
    interface Shape {
      email: string;
      phones: Phone[];
    }
    const model = createModel<Shape>({ email: '', phones: [] });

    const form = createFormFromModel<Shape>({ model });
    form.email.setValue('a@b.c');

    expect(form.email.component).toBeUndefined();
    expect((form as unknown as Record<string, unknown>).phones).toBeUndefined();
    expect(model.email).toBe('a@b.c');
  });
});

describe('createFormFromModel — конфиг ноды из компиляции', () => {
  it('одна ручка в двух полях: нода берёт компонент, пропсы и `disabled` последней привязки', () => {
    // Так задумано (решение по arpz): нода у ручки одна, и действует последняя привязка — с
    // dev-предупреждением [ReFormer-dd58]. Конфиг первой теряется: `disabled: true` у «сводки» в
    // конце визарда выключает и поле ввода на первом шаге — сводку привязывают без `disabled`.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createModel({ email: '' });

    const form = createFormFromModel<{ email: string }>({
      model,
      schema: {
        children: [
          { model: model.$.email, component: InputStub, componentProps: { label: 'Почта' } },
          {
            selector: 'summary',
            model: model.$.email,
            component: SectionStub,
            componentProps: { label: 'Сводка' },
            disabled: true,
          },
        ],
      },
    });

    expect(form.email.component).toBe(SectionStub);
    expect(form.email.componentProps.value).toEqual({ label: 'Сводка' });
    expect(form.email.disabled.value).toBe(true);
  });

  it('`part` на ручке массива: массив в форме не материализуется', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = createModel<{ phones: Phone[] }>({ phones: [{ number: '1' }] });

    const form = createFormFromModel<{ phones: Phone[] }>({
      model,
      schema: {
        children: [{ model: model.$.phones, part: phoneItem }],
      } as unknown as FormSchemaNode,
    });

    expect((form as unknown as Record<string, unknown>).phones).toBeUndefined();
    expect(getNodeForSignal(model.$.phones)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('у узла с `part` привязка — не группа модели')
    );
  });

  it('поле над массивом внутри подформы — нода поля с конфигом из компиляции части', () => {
    interface Office {
      tags: string[];
    }
    const model = createModel<{ office: Office }>({ office: { tags: [] } });

    const form = createFormFromModel<{ office: Office }>({
      model,
      schema: {
        children: [
          {
            model: model.$.office,
            part: (office: FormModel<Office>) => ({ model: office.$.tags, component: SelectStub }),
          },
        ],
      },
    });

    const tags = (form.office as unknown as { tags: { component: unknown } }).tags;
    expect(tags.component).toBe(SelectStub);
    expect(getNodeForSignal(model.office.$.tags)).toBe(tags);
  });
});

describe('createFormFromModel — запасной шаблон строки из схемы', () => {
  it('массив в подформе получает шаблон при сборке корня', () => {
    interface Office {
      phones: Phone[];
    }
    // Модель из данных, без `arrayOf`: своего шаблона строки у массива нет.
    const model = createModel<{ office: Office }>({ office: { phones: [] } });

    createFormFromModel<{ office: Office }>({
      model,
      schema: {
        children: [
          {
            model: model.$.office,
            part: (office: FormModel<Office>) => ({
              model: office.$.phones,
              item: phoneItem,
              initialValue: { number: '+7' },
            }),
          },
        ],
      },
    });
    model.office.phones.push();

    expect(model.get().office.phones).toEqual([{ number: '+7' }]);
  });

  it('массив в строке другого массива получает шаблон, когда собирается форма строки', () => {
    interface Contact {
      name: string;
      phones: Phone[];
    }
    const model = createModel<{ contacts: Contact[] }>({
      contacts: [{ name: 'Анна', phones: [] }],
    });
    const contactItem = (contact: FormModel<Contact>): FormSchemaNode => ({
      children: [
        { model: contact.$.name, component: InputStub },
        { model: contact.$.phones, item: phoneItem, initialValue: { number: '+7' } },
      ],
    });

    createFormFromModel<{ contacts: Contact[] }>({
      model,
      schema: {
        children: [
          {
            model: model.$.contacts,
            item: contactItem,
            initialValue: { name: 'новый', phones: [] },
          },
        ],
      },
    });
    model.contacts.at(0)!.phones.push();
    model.contacts.push();
    model.contacts.at(1)!.phones.push();

    expect(model.get().contacts).toEqual([
      { name: 'Анна', phones: [{ number: '+7' }] },
      { name: 'новый', phones: [{ number: '+7' }] },
    ]);
  });
});
