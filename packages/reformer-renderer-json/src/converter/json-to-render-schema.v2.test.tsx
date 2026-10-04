/**
 * Конвертер документа формата 2: привязка ключом `model`, подформы (`part`), именованные части
 * (`parts`), шаблон строки вписанным узлом и частью, шаги визарда в `children`.
 *
 * Проверяется на настоящей модели: в формате 2 узлы привязываются ручками модели, а не путями.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { arrayOf, createForm, createModel, modelOf, type FormModel } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { convertJsonSchema } from './json-to-render-schema';
import { defineRegistry } from '../registry/component-registry';
import { FIELD_WRAPPER } from '../registry/constants';
import { SchemaErrorBoundary } from '../components/schema-error-boundary';
import type { JsonFormSchema } from '../types/json-schema';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Address {
  city: string;
  street: string;
}
interface Phone {
  number: string;
}
interface CoBorrower {
  name: string;
  phones: Phone[];
}
interface Shape {
  loanType: string;
  tags: string[];
  registration: Address;
  residence: Address;
  coBorrowers: CoBorrower[];
}

const blankPhone = (): Phone => ({ number: '' });
const blankCoBorrower = (): CoBorrower => ({ name: '', phones: arrayOf(blankPhone) });

const createShape = () =>
  createModel<Shape>({
    loanType: 'consumer',
    tags: [],
    registration: { city: 'Казань', street: '' },
    residence: { city: 'Москва', street: '' },
    coBorrowers: arrayOf(blankCoBorrower, [{ name: 'Анна', phones: [{ number: '111' }] }]),
  });

const Input = ({ value, label }: any) => (
  <input data-label={label} defaultValue={String(value ?? '')} />
);
const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const Section = ({ title, children }: { title?: string; children?: ReactNode }) => (
  <section data-title={title}>{children}</section>
);
const Step = Section;
const List = ({ items }: any) => (
  <ul>
    {items.map((item: any) => (
      <li key={item.key}>{item.children}</li>
    ))}
  </ul>
);
const Wrapper = ({ children }: { children?: ReactNode }) => <label>{children}</label>;

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component('Section', Section);
  reg.component('Step', Step);
  reg.component('List', List);
  reg.component(FIELD_WRAPPER, Wrapper);
});

const document: JsonFormSchema<Shape> = {
  format: 2,
  parts: {
    address: {
      component: '$component(Box)',
      children: [
        {
          model: '$model(city)',
          component: '$component(Input)',
          componentProps: { label: 'Город' },
        },
        { selector: 'street', model: '$model(street)', component: '$component(Input)' },
      ],
    },
    phone: { model: '$model(number)', component: '$component(Input)' },
    coBorrower: {
      component: '$component(Box)',
      children: [
        { model: '$model(name)', component: '$component(Input)', componentProps: { label: 'Имя' } },
        { model: '$model(phones)', component: '$component(List)', item: '$part(phone)' },
      ],
    },
  },
  root: {
    component: '$component(Box)',
    children: [
      { model: '$model(loanType)', component: '$component(Input)' },
      { model: '$model(tags)', component: '$component(Input)' },
      {
        selector: 'registration',
        component: '$component(Section)',
        componentProps: { title: 'Регистрация' },
        children: [{ model: '$model(registration)', part: '$part(address)' }],
      },
      { model: '$model(residence)', part: '$part(address)' },
      { model: '$model(coBorrowers)', component: '$component(List)', item: '$part(coBorrower)' },
    ],
  },
};

const rootChildren = (model: FormModel<Shape>): any[] =>
  (convertJsonSchema<Shape>(document, registry, model) as any).children;

describe('convertJsonSchema: узлы формата 2', () => {
  it('поле привязывается ручкой модели под ключом `model`', () => {
    const model = createShape();
    const [loanType, tags] = rootChildren(model);

    expect(loanType.model).toBe(model.$.loanType);
    expect(loanType.component).toBe(Input);
    expect('value' in loanType).toBe(false);
    // Массив без `item` — значение одного поля, а не массив под-форм.
    expect(tags.model).toBe(model.$.tags);
    expect(tags.item).toBeUndefined();
  });

  it('подформа: узел `{ model, part }` с ручкой группы, пути части относительны группе', () => {
    const model = createShape();
    const children = rootChildren(model);
    const registration = children[2].children[0];
    const residence = children[3];

    expect(registration.model).toBe(model.$.registration);
    expect(typeof registration.part).toBe('function');
    expect(residence.model).toBe(model.$.residence);

    const registrationTree = registration.part(modelOf(model.$.registration));
    const residenceTree = residence.part(modelOf(model.$.residence));
    expect(registrationTree.children[0].model).toBe(model.$.registration.city);
    expect(residenceTree.children[0].model).toBe(model.$.residence.city);
    expect(residenceTree.children[1].selector).toBe('street');
  });

  it('массив: шаблон строки из именованной части, вложенный массив — тоже', () => {
    const model = createShape();
    const coBorrowers = rootChildren(model)[4];

    expect(coBorrowers.model).toBe(model.$.coBorrowers);
    expect(coBorrowers.component).toBe(List);
    // Запасной шаблон нового элемента в документе не задан — в узле его нет.
    expect('initialValue' in coBorrowers).toBe(false);
    expect('array' in coBorrowers).toBe(false);

    const first = model.coBorrowers.at(0)!;
    const row = coBorrowers.item(first);
    expect(row.children[0].model).toBe(first.$.name);
    expect(row.children[1].model).toBe(first.$.phones);
    const phone = first.phones.at(0)!;
    expect(row.children[1].item(phone).model).toBe(phone.$.number);
  });

  it('массив: вписанный шаблон и запасной `initialValue` — отдельная копия на каждый вызов', () => {
    const model = createShape();
    const tree = convertJsonSchema<Shape>(
      {
        format: 2,
        root: {
          model: '$model(coBorrowers)',
          initialValue: { name: 'новый', phones: [] },
          item: { $template: { model: '$model(name)', component: '$component(Input)' } },
        },
      },
      registry,
      model
    ) as any;

    const first = model.coBorrowers.at(0)!;
    expect(tree.item(first).model).toBe(first.$.name);
    const a = tree.initialValue();
    const b = tree.initialValue();
    expect(a).toEqual({ name: 'новый', phones: [] });
    expect(a).not.toBe(b);
  });

  it('шаги визарда — обычные дети узла', () => {
    const model = createShape();
    const tree = convertJsonSchema<Shape>(
      {
        format: 2,
        root: {
          selector: 'wizard',
          component: '$component(Box)',
          children: [
            {
              selector: 'loan',
              component: '$component(Step)',
              componentProps: { title: 'Кредит' },
              children: [{ model: '$model(loanType)', component: '$component(Input)' }],
            },
          ],
        },
      },
      registry,
      model
    ) as any;

    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].selector).toBe('loan');
    expect(tree.children[0].componentProps).toEqual({ title: 'Кредит' });
    expect(tree.children[0].children[0].model).toBe(model.$.loanType);
  });
});

describe('convertJsonSchema: ошибки документа', () => {
  const convert = (root: unknown, parts?: Record<string, unknown>) =>
    convertJsonSchema<Shape>(
      { format: 2, ...(parts ? { parts } : {}), root } as JsonFormSchema<Shape>,
      registry,
      createShape()
    );

  it('документ прежнего формата отвергается с отсылкой к migrateJsonSchema', () => {
    expect(() =>
      convertJsonSchema({ root: { component: '$component(Box)' } } as any, registry, createShape())
    ).toThrow(/migrateJsonSchema/);
  });

  it('неизвестная часть — ошибка сразу, при сборке дерева; называет доступные', () => {
    expect(() =>
      convert(
        { model: '$model(registration)', part: '$part(adress)' },
        { address: { component: '$component(Box)' } }
      )
    ).toThrow(/Part "adress" not found.*Available: address/);
  });

  it('шаблон строки из неизвестной части — ошибка сразу, при сборке дерева', () => {
    expect(() =>
      convert({ model: '$model(coBorrowers)', item: '$part(nope)' }, { address: {} })
    ).toThrow(/Part "nope" not found/);
  });

  it('подформа подключается только к группе модели', () => {
    expect(() =>
      convert({ model: '$model(loanType)', part: '$part(address)' }, { address: {} })
    ).toThrow(/\$model\(loanType\)" is not a group/);
  });

  it('несобранная ссылка на шаг в `children` — ошибка с отсылкой к composeJsonFormSchema', () => {
    expect(() =>
      convert({
        component: '$component(Box)',
        children: [{ $ref: './steps/loan/form.schema.json' }],
      })
    ).toThrow(/steps\/loan\/form\.schema\.json.*composeJsonFormSchema/);
  });
});

describe('единая сборка: createForm({ model, schema: документ, registry })', () => {
  it('реестр отдаёт дерево, обёртку поля и границу ошибок', () => {
    const model = createShape();
    const resolved = registry.resolveSchema!(document, model as FormModel<never>);

    expect((resolved.tree as any).component).toBe(Box);
    expect(resolved.fieldWrapper).toBe(Wrapper);
    expect(resolved.errorBoundary).toBe(SchemaErrorBoundary);
  });

  it('реестр без записи FIELD_WRAPPER обёртку не отдаёт', () => {
    const bare = defineRegistry((reg) => {
      reg.component('Input', Input);
      reg.component('Box', Box);
    });
    const resolved = bare.resolveSchema!(
      { format: 2, root: { component: '$component(Box)' } },
      createShape() as FormModel<never>
    );
    expect('fieldWrapper' in resolved).toBe(false);
  });

  it('форма строится из документа: поля групп, строки массивов и вложенные массивы', () => {
    const bundle = createForm<Shape>({ model: createShape(), schema: document, registry });
    const form = bundle.form as any;

    expect(form.loanType.value.value).toBe('consumer');
    expect(form.registration.city.value.value).toBe('Казань');
    expect(form.residence.city.value.value).toBe('Москва');
    expect(form.coBorrowers.at(0).name.value.value).toBe('Анна');
    expect(form.coBorrowers.at(0).phones.at(0).number.value.value).toBe('111');
    expect(bundle.render.fieldWrapper).toBe(Wrapper);
    expect(bundle.render.errorBoundary).toBe(SchemaErrorBoundary);
  });

  it('«Добавить» берёт шаблон из модели: документу `initialValue` не нужен', () => {
    const bundle = createForm<Shape>({ model: createShape(), schema: document, registry });

    bundle.model.coBorrowers.push();
    const added = bundle.model.coBorrowers.at(1)!;
    expect(added.get()).toEqual({ name: '', phones: [] });
    added.phones.push();
    expect(added.phones.at(0)!.get()).toEqual({ number: '' });
  });

  it('запасной `initialValue` документа работает, когда модель шаблона не объявила', () => {
    const model = createModel<{ rows: { name: string }[] }>({ rows: [] });
    const bundle = createForm<{ rows: { name: string }[] }>({
      model,
      schema: {
        format: 2,
        root: {
          model: '$model(rows)',
          component: '$component(List)',
          initialValue: { name: 'новый' },
          item: { $template: { model: '$model(name)', component: '$component(Input)' } },
        },
      },
      registry,
    });

    bundle.model.rows.push();
    expect(bundle.model.rows.at(0)!.get()).toEqual({ name: 'новый' });
  });

  it('FormRenderer рисует бандл: подформы, строки массива и обёртку поля из реестра', () => {
    const bundle = createForm<Shape>({ model: createShape(), schema: document, registry });
    const html = renderToStaticMarkup(<FormRenderer form={bundle} />);

    expect(html).toContain('data-title="Регистрация"');
    expect(html).toContain('value="Казань"');
    expect(html).toContain('value="Москва"');
    expect(html).toContain('value="Анна"');
    expect(html).toContain('value="111"');
    expect(html).toContain('<label>');
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
