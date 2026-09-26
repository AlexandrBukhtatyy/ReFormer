import { describe, expect, it } from 'vitest';
import {
  applyRjsfOp,
  checkRjsfForm,
  displayOrder,
  initialValues,
  isRjsfForm,
  looksLikeRjsfForm,
  nextFieldName,
  parseRjsfForm,
  printFormModule,
  printRjsfForm,
  RJSF_SCHEMA_ID,
  sampleForm,
  type RjsfForm,
  type RjsfOp,
} from './index';

const form = sampleForm();

/** Форма с порядком показа, в котором `'*'` покрывает остальные поля. */
function orderedForm(): RjsfForm {
  return {
    ...form,
    uiSchema: { ...form.uiSchema, 'ui:order': ['agree', '*'] },
  };
}

/** Форма с полным порядком без `'*'`. */
function fullOrderForm(): RjsfForm {
  return {
    ...form,
    uiSchema: { ...form.uiSchema, 'ui:order': ['agree', 'name', 'age', 'channel'] },
  };
}

const keys = (value: RjsfForm) => Object.keys(value.schema.properties);

/** Закон обратимости: операция и её обратная возвращают документ — и порядок полей тоже. */
function expectRoundTrip(start: RjsfForm, op: RjsfOp): RjsfForm {
  const applied = applyRjsfOp(start, op);
  const back = applyRjsfOp(applied.model, applied.inverse).model;
  expect(back).toEqual(start);
  expect(keys(back)).toEqual(keys(start));
  expect(back.uiSchema?.['ui:order']).toEqual(start.uiSchema?.['ui:order']);
  expect(back.schema.required).toEqual(start.schema.required);
  return applied.model;
}

describe('разбор и печать', () => {
  it('печать и разбор — взаимно обратные, порядок полей тот же', () => {
    const back = parseRjsfForm(printRjsfForm(form));

    expect(back).toEqual(form);
    expect(keys(back)).toEqual(keys(form));
  });

  it('незнакомые ключи JSON Schema и документа проходят круг как есть', () => {
    const text = JSON.stringify({
      $schema: RJSF_SCHEMA_ID,
      comment: 'свой ключ',
      schema: {
        type: 'object',
        properties: { email: { type: 'string', format: 'email', minLength: 3 } },
      },
    });

    expect(parseRjsfForm(printRjsfForm(parseRjsfForm(text)))).toEqual(JSON.parse(text));
  });

  it('проба по тексту узнаёт свой документ и не узнаёт чужие', () => {
    expect(looksLikeRjsfForm(printRjsfForm(form))).toBe(true);
    // Схема ReFormer и простая форма демо-стека.
    expect(looksLikeRjsfForm('{"version":"1.0","root":{}}')).toBe(false);
    expect(looksLikeRjsfForm('{"$schema":"plain-form/1","fields":[]}')).toBe(false);
  });

  it('отказ разбора называет, что не так', () => {
    const nested = JSON.stringify({
      $schema: RJSF_SCHEMA_ID,
      schema: { type: 'object', properties: { address: { type: 'object', properties: {} } } },
    });

    expect(() => parseRjsfForm(nested)).toThrow('schema.properties.address.type');
    expect(() => parseRjsfForm('{"$schema":"rjsf-form/1","schema":{"type":"array"}}')).toThrow(
      'schema.type'
    );
    expect(isRjsfForm({ $schema: 'plain-form/1' })).toBe(false);
  });
});

describe('операции', () => {
  it('добавление встаёт в конец, обязательным — в required, и отменяется целиком', () => {
    const model = expectRoundTrip(form, {
      type: 'add-field',
      params: {
        name: 'email',
        field: { type: 'string', title: 'Почта', format: 'email' },
        required: true,
        ui: { 'ui:placeholder': 'you@example.com' },
      },
    });

    expect(keys(model)).toEqual(['name', 'age', 'channel', 'agree', 'email']);
    expect(model.schema.required).toEqual(['name', 'email']);
    expect(model.uiSchema?.email).toEqual({ 'ui:placeholder': 'you@example.com' });
  });

  it('новое поле встаёт в полный порядок, а порядок со «*» его и так покрывает', () => {
    const full = applyRjsfOp(fullOrderForm(), {
      type: 'add-field',
      params: { name: 'email', field: { type: 'string' } },
    }).model;
    const star = applyRjsfOp(orderedForm(), {
      type: 'add-field',
      params: { name: 'email', field: { type: 'string' } },
    }).model;

    expect(full.uiSchema?.['ui:order']).toEqual(['agree', 'name', 'age', 'channel', 'email']);
    expect(star.uiSchema?.['ui:order']).toEqual(['agree', '*']);
    expect(checkRjsfForm(full)).toEqual([]);
  });

  it('удаление снимает поле отовсюду, а отмена возвращает его на прежние места', () => {
    const model = expectRoundTrip(fullOrderForm(), {
      type: 'remove-field',
      params: { name: 'name' },
    });

    expect(keys(model)).toEqual(['age', 'channel', 'agree']);
    // Единственное обязательное поле ушло — пустого required не остаётся.
    expect(model.schema.required).toBeUndefined();
    expect(model.uiSchema).toEqual({ 'ui:order': ['agree', 'age', 'channel'] });
  });

  it('переименование держит место поля и увозит с собой required, порядок и подсказки', () => {
    const model = expectRoundTrip(fullOrderForm(), {
      type: 'rename-field',
      params: { name: 'name', to: 'fullName' },
    });

    expect(keys(model)).toEqual(['fullName', 'age', 'channel', 'agree']);
    expect(model.schema.required).toEqual(['fullName']);
    expect(model.uiSchema?.['ui:order']).toEqual(['agree', 'fullName', 'age', 'channel']);
    expect(model.uiSchema?.fullName).toEqual({ 'ui:placeholder': 'Как к вам обращаться' });
    expect(model.uiSchema?.name).toBeUndefined();
  });

  it('перемещение идёт в порядке показа: в ui:order, если он есть, иначе в properties', () => {
    const plain = expectRoundTrip(form, {
      type: 'move-field',
      params: { name: 'agree', index: 0 },
    });
    const ordered = expectRoundTrip(fullOrderForm(), {
      type: 'move-field',
      params: { name: 'agree', index: 3 },
    });

    expect(keys(plain)).toEqual(['agree', 'name', 'age', 'channel']);
    expect(ordered.uiSchema?.['ui:order']).toEqual(['name', 'age', 'channel', 'agree']);
    expect(keys(ordered)).toEqual(keys(form));
  });

  it('правка поля: схема, обязательность и подсказки — одной операцией и одной отменой', () => {
    const model = expectRoundTrip(form, {
      type: 'set-field',
      params: {
        name: 'age',
        field: { type: 'number', title: 'Возраст, лет' },
        required: true,
        ui: { 'ui:widget': 'updown' },
      },
    });

    expect(model.schema.properties.age).toEqual({ type: 'number', title: 'Возраст, лет' });
    expect(model.schema.required).toEqual(['name', 'age']);
    expect(model.uiSchema?.age).toEqual({ 'ui:widget': 'updown' });
    // Снятие обязательности и подсказок — тоже обратимо, место в required возвращается.
    expectRoundTrip(model, {
      type: 'set-field',
      params: { name: 'name', required: false, ui: null },
    });
  });

  it('заголовок формы ставится и снимается', () => {
    const model = expectRoundTrip(form, { type: 'set-title', params: { title: null } });

    expect(model.schema.title).toBeUndefined();
    expectRoundTrip(model, { type: 'set-title', params: { title: 'Анкета' } });
  });

  it('отказы называют причину', () => {
    expect(() =>
      applyRjsfOp(form, { type: 'add-field', params: { name: 'name', field: { type: 'string' } } })
    ).toThrow('уже есть');
    expect(() =>
      applyRjsfOp(form, { type: 'add-field', params: { name: ' ', field: { type: 'string' } } })
    ).toThrow('пустое');
    expect(() => applyRjsfOp(form, { type: 'remove-field', params: { name: 'nope' } })).toThrow(
      'поля «nope» нет'
    );
    expect(() =>
      applyRjsfOp(form, { type: 'rename-field', params: { name: 'name', to: 'age' } })
    ).toThrow('уже есть');
  });

  it('свободное имя нового поля не занято', () => {
    const withField1 = applyRjsfOp(form, {
      type: 'add-field',
      params: { name: 'field1', field: { type: 'string' } },
    }).model;

    expect(nextFieldName(form)).toBe('field1');
    expect(nextFieldName(withField1)).toBe('field2');
  });
});

describe('порядок показа и значения', () => {
  it('«*» разворачивается в поля, не названные в порядке', () => {
    expect(displayOrder(orderedForm())).toEqual(['agree', 'name', 'age', 'channel']);
    expect(displayOrder(form)).toEqual(['name', 'age', 'channel', 'agree']);
  });

  it('сохранённые значения — поверх default, но только для полей формы', () => {
    const withDefault = applyRjsfOp(form, {
      type: 'set-field',
      params: { name: 'channel', field: { type: 'string', enum: ['email'], default: 'email' } },
    }).model;

    expect(initialValues(withDefault, { name: 'Анна', removed: 'x' })).toEqual({
      name: 'Анна',
      channel: 'email',
    });
  });
});

describe('проверки', () => {
  const codes = (value: RjsfForm, widgets?: ReadonlySet<string>) =>
    checkRjsfForm(value, widgets === undefined ? {} : { widgets }).map((problem) => problem.code);

  it('заготовка чиста', () => {
    expect(codes(form)).toEqual([]);
  });

  it('обязательное поле, которого нет, и чужие имена в порядке — ошибки', () => {
    const broken: RjsfForm = {
      ...form,
      schema: { ...form.schema, required: ['name', 'ghost'] },
      uiSchema: { 'ui:order': ['ghost', 'name', 'age', 'channel', 'agree'] },
    };

    expect(codes(broken)).toEqual(['required-unknown', 'order-unknown']);
  });

  it('неполный порядок без «*» — ошибка по каждому пропущенному полю', () => {
    const partial: RjsfForm = { ...form, uiSchema: { 'ui:order': ['agree', 'name'] } };

    expect(checkRjsfForm(partial).map((problem) => [problem.code, problem.field])).toEqual([
      ['order-missing', 'age'],
      ['order-missing', 'channel'],
    ]);
  });

  it('пустой выбор и пустое имя', () => {
    const odd: RjsfForm = {
      ...form,
      schema: {
        ...form.schema,
        properties: {
          ...form.schema.properties,
          '': { type: 'string' },
          pick: { type: 'string', enum: [] },
        },
      },
    };

    expect(codes(odd)).toEqual(['empty-name', 'enum-empty']);
  });

  it('неизвестный виджет — только когда проверке назвали доступные', () => {
    const custom: RjsfForm = { ...form, uiSchema: { agree: { 'ui:widget': 'Switch' } } };

    expect(codes(custom)).toEqual([]);
    expect(codes(custom, new Set(['CheckboxWidget']))).toEqual(['widget-unknown']);
    expect(codes(custom, new Set(['Switch']))).toEqual([]);
    const alias: RjsfForm = { ...form, uiSchema: { age: { 'ui:widget': 'updown' } } };
    expect(codes(alias, new Set())).toEqual([]);
  });
});

describe('печать Form.tsx', () => {
  it('RJSF с валидатором, схема литералом, тип значений по полям', () => {
    const code = printFormModule(form, { componentName: 'contact-form' });

    expect(code.split('\n')[0]).toMatch(/^\/\/ @reformer-generated /);
    expect(code).toContain("import Form from '@rjsf/core';");
    expect(code).toContain("import validator from '@rjsf/validator-ajv8';");
    expect(code).toContain('export function Contactform(');
    expect(code).toContain('"name": string;');
    expect(code).toContain('"age"?: number;');
    expect(code).toContain('"channel"?: "email" | "телефон";');
    expect(code).toContain('"agree"?: boolean;');
    expect(code).toContain('"title": "Контакт"');
  });

  it('подпись с кавычками и скобками не ломает файл: она внутри JSON-литерала', () => {
    const tricky = applyRjsfOp(form, {
      type: 'set-title',
      params: { title: 'Анкета "{x}" `y`' },
    }).model;

    expect(printFormModule(tricky)).toContain('"title": "Анкета \\"{x}\\" `y`"');
  });
});
