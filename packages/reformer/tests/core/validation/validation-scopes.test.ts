/**
 * Области схемы валидации: `apply(ручка группы, схема)` и `applyEach(ручка массива, схема)`.
 *
 * Схема подформы и схема элемента массива — обычная `ValidationSchema` над своим типом. У неё своя
 * область: `model` — под-модель, `cross` получает её снапшот. Сток ошибок, условия `validateWhen`
 * и отмена — общие с родительской схемой.
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { required } from '../../../src/form/validators';
import {
  validate,
  validateAsync,
  validateWhen,
  cross,
  each,
  apply,
  applyEach,
  defineValidationSchema,
  validateModel,
} from '../../../src/form/validation';
import type { FormModel } from '../../../src/model/types';
import type { ValidationError } from '../../../src/form/types/index';

const InputStub = () => null;

interface Address {
  city: string;
  street: string;
}
interface Property {
  type: string;
  price: number;
  limit: number;
}
interface Shape {
  sameAddress: boolean;
  registration: Address;
  residence: Address;
  properties: Property[];
  tags: string[];
}

const createShape = (over: Partial<Shape> = {}) =>
  createModel<Shape>({
    sameAddress: false,
    registration: { city: '', street: '' },
    residence: { city: '', street: '' },
    properties: [],
    tags: [],
    ...over,
  });

const addressPart = (model: FormModel<Address>) => ({
  children: [
    { model: model.$.city, component: InputStub },
    { model: model.$.street, component: InputStub },
  ],
});
const propertyItem = (model: FormModel<Property>) => ({
  children: [
    { model: model.$.type, component: InputStub },
    { model: model.$.price, component: InputStub },
    { model: model.$.limit, component: InputStub },
  ],
});

function createShapeForm(over: Partial<Shape> = {}) {
  const model = createShape(over);
  const form = createFormFromModel<Shape>({
    model,
    schema: {
      children: [
        { model: model.$.sameAddress, component: InputStub },
        { model: model.$.registration, part: addressPart },
        { model: model.$.residence, part: addressPart },
        { model: model.$.properties, item: propertyItem },
      ],
    },
  });
  return { model, form };
}

const error = (code: string): ValidationError => ({ code, message: code });
const codesOf = (node: { errors: { value: ValidationError[] } }) =>
  node.errors.value.map((item) => item.code);

const addressRules = defineValidationSchema<Address>(({ model }) => {
  validate(model.$.city, [required()]);
  cross<Address>(model.$.street, (address) =>
    address.city !== '' && address.street === '' ? error('streetRequired') : null
  );
});

const propertyRules = defineValidationSchema<Property>(({ model }) => {
  validate(model.$.type, [required()]);
  cross<Property>(model.$.price, (property) =>
    property.price > property.limit ? error('overLimit') : null
  );
});

describe('apply(ручка группы, схема)', () => {
  it('ошибки подформы доходят до нод группы', async () => {
    const { model, form } = createShapeForm();
    const rules = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.registration, addressRules);
    });

    expect(await validateModel(model, rules)).toBe(false);
    expect(codesOf(form.registration.city)).toEqual(['required']);
    expect(codesOf(form.residence.city)).toEqual([]);
  });

  it('`cross` внутри подформы получает снапшот под-модели, а не корня', async () => {
    const { model, form } = createShapeForm({ registration: { city: 'Казань', street: '' } });
    const rules = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.registration, addressRules);
    });

    expect(await validateModel(model, rules)).toBe(false);
    expect(codesOf(form.registration.street)).toEqual(['streetRequired']);
  });

  it('одна схема подключается к нескольким группам — массивом ручек', async () => {
    const { model, form } = createShapeForm({ residence: { city: 'Казань', street: 'Баумана' } });
    const rules = defineValidationSchema<Shape>(({ model }) => {
      apply([model.$.registration, model.$.residence], addressRules);
    });

    expect(await validateModel(model, rules)).toBe(false);
    expect(codesOf(form.registration.city)).toEqual(['required']);
    expect(codesOf(form.residence.city)).toEqual([]);
  });

  it('под `validateWhen` подформа гасится вместе с условием', async () => {
    const { model, form } = createShapeForm();
    const rules = defineValidationSchema<Shape>(({ model }) => {
      validateWhen(
        () => !model.sameAddress,
        () => apply(model.$.residence, addressRules)
      );
    });

    expect(await validateModel(model, rules)).toBe(false);
    expect(codesOf(form.residence.city)).toEqual(['required']);

    model.sameAddress = true;
    expect(await validateModel(model, rules)).toBe(true);
    expect(codesOf(form.residence.city)).toEqual([]);
  });

  it('правило получает область вторым аргументом и корень прогона третьим', async () => {
    const model = createShape();
    const seen: unknown[] = [];
    const spy = ((value: unknown, scope: unknown, root: unknown) => {
      seen.push(scope, root);
      return null;
    }) as never;
    const subRules = defineValidationSchema<Address>(({ model }) => {
      validate(model.$.city, [spy]);
    });
    const rules = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.registration, subRules);
    });

    await validateModel(model, rules);

    expect(seen).toEqual([model.registration, model]);
  });

  it('после подформы область родителя возвращается', async () => {
    const model = createShape({ registration: { city: 'Казань', street: 'Баумана' } });
    let snapshot: unknown;
    const rules = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.registration, addressRules);
      cross<Shape>(model.$.sameAddress, (shape) => {
        snapshot = shape;
        return null;
      });
    });

    await validateModel(model, rules);

    expect(snapshot).toEqual(model.get());
  });

  it('асинхронное правило подформы дожидается раннером', async () => {
    const { model, form } = createShapeForm({ registration: { city: 'x', street: 'y' } });
    const subRules = defineValidationSchema<Address>(({ model }) => {
      validateAsync(model.$.city, [async () => error('taken')]);
    });
    const rules = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.registration, subRules);
    });

    expect(await validateModel(model, rules)).toBe(false);
    expect(codesOf(form.registration.city)).toEqual(['taken']);
  });

  it('композиция схем над той же моделью остаётся', async () => {
    const model = createShape();
    const first = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.registration, addressRules);
    });
    const second = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.residence, addressRules);
    });
    const all = defineValidationSchema<Shape>(() => apply(first, second));

    expect(await validateModel(model, all)).toBe(false);
    model.registration.city = 'a';
    model.registration.street = 'b';
    expect(await validateModel(model, all)).toBe(false);
    model.residence.city = 'a';
    model.residence.street = 'b';
    expect(await validateModel(model, all)).toBe(true);
  });

  it('не группа — понятная ошибка', async () => {
    const model = createShape();
    const rules = defineValidationSchema<Shape>(({ model }) => {
      apply(model.$.properties as never, addressRules);
    });

    await expect(validateModel(model, rules)).rejects.toThrow(/apply: ожидалась группа модели/);
  });
});

describe('applyEach(ручка массива, схема)', () => {
  const twoProperties: Property[] = [
    { type: '', price: 10, limit: 100 },
    { type: 'flat', price: 500, limit: 100 },
  ];

  it('схема элемента применяется к каждой строке; ошибки доходят до нод строк', async () => {
    const { model, form } = createShapeForm({ properties: twoProperties });
    const rules = defineValidationSchema<Shape>(({ model }) => {
      applyEach(model.$.properties, propertyRules);
    });

    expect(await validateModel(model, rules)).toBe(false);
    const rows = form.properties as unknown as {
      at(index: number): Record<keyof Property, { errors: { value: ValidationError[] } }>;
    };
    expect(codesOf(rows.at(0).type)).toEqual(['required']);
    expect(codesOf(rows.at(1).type)).toEqual([]);
  });

  it('`cross` в схеме элемента получает снапшот элемента', async () => {
    const { model, form } = createShapeForm({ properties: twoProperties });
    const rules = defineValidationSchema<Shape>(({ model }) => {
      applyEach(model.$.properties, propertyRules);
    });

    await validateModel(model, rules);

    const rows = form.properties as unknown as {
      at(index: number): Record<keyof Property, { errors: { value: ValidationError[] } }>;
    };
    expect(codesOf(rows.at(0).price)).toEqual([]);
    expect(codesOf(rows.at(1).price)).toEqual(['overLimit']);
  });

  it('привязка фасадом массива принимается наравне с ручкой', async () => {
    const model = createShape({ properties: twoProperties });
    const rules = defineValidationSchema<Shape>(({ model }) => {
      applyEach(model.properties, propertyRules);
    });

    expect(await validateModel(model, rules)).toBe(false);
  });

  it('одна схема подходит и группе, и элементам массива', async () => {
    interface Contacts {
      main: Address;
      extra: Address[];
    }
    const model = createModel<Contacts>({
      main: { city: 'Казань', street: 'Баумана' },
      extra: [{ city: '', street: '' }],
    });
    const rules = defineValidationSchema<Contacts>(({ model }) => {
      apply(model.$.main, addressRules);
      applyEach(model.$.extra, addressRules);
    });

    expect(await validateModel(model, rules)).toBe(false);
    model.extra.at(0).city = 'Казань';
    model.extra.at(0).street = 'Баумана';
    expect(await validateModel(model, rules)).toBe(true);
  });

  it('массив примитивов — понятная ошибка', async () => {
    const model = createShape();
    const rules = defineValidationSchema<Shape>(({ model }) => {
      applyEach(model.$.sameAddress as never, propertyRules);
    });

    await expect(validateModel(model, rules)).rejects.toThrow(
      /applyEach: ожидался массив под-форм модели/
    );
  });
});

describe('each — прежняя запись', () => {
  it('принимает и фасад, и ручку массива', async () => {
    const model = createShape({ properties: [{ type: '', price: 0, limit: 0 }] });
    const byHandle = defineValidationSchema<Shape>(({ model }) => {
      each(model.$.properties, (property) => validate(property.$.type, [required()]));
    });
    const byFacade = defineValidationSchema<Shape>(({ model }) => {
      each(model.properties, (property) => validate(property.$.type, [required()]));
    });

    expect(await validateModel(model, byHandle)).toBe(false);
    expect(await validateModel(model, byFacade)).toBe(false);
  });
});
