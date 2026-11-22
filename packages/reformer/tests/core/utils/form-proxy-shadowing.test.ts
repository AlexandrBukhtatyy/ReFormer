/**
 * Regression tests for defect #28 и сокращённого набора затеняемых имён.
 *
 * Точкой `form.<name>` поле недостижимо, только если его имя — член контракта {@link FormNode}
 * (`value`, `issues`, `reset`, …): там член ноды. Пространство `form.$.<name>` отдаёт ноду поля
 * всегда. Прочие имена — `id`, `status`, `fields`, `submit`, внутренности класса — поля.
 *
 * Ниже — остальные ловушки прокси группы (`set`, `has`, `ownKeys`, `getOwnPropertyDescriptor`),
 * пространство `$` и привязанные к сырому узлу методы: они стабильны по идентичности (их можно
 * класть в зависимости хуков) и работают отдельно от лица (`const { reset } = form`).
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { isFormControl, isFormGroup } from '../../../src/form/type-guards';
import { NODE_KIND, rawNode } from '../../../src/form/nodes/node-kind';

interface ShadowedModel {
  value: string; // член FormNode — затенён
  issues: string; // член FormNode — затенён
  status: string; // не член контракта — поле
  id: string; // не член контракта — поле
  email: string;
}

function makeForm() {
  const model = createModel<ShadowedModel>({
    value: 'raw',
    issues: 'none',
    status: 'active',
    id: 'user-42',
    email: 'e@x.com',
  });
  return createFormFromModel<ShadowedModel>({ model });
}

describe('FormGroup — затенение полей членами FormNode', () => {
  it('form.<член FormNode> возвращает член ноды, а не поле', () => {
    const form = makeForm();

    // value → значение всей группы
    expect(form.value.value).toMatchObject({ email: 'e@x.com', status: 'active' });
    // issues → замечания группы
    expect(form.issues.value).toEqual([]);
    expect(typeof form.reset).toBe('function');
  });

  it('form.$ даёт доступ к затенённым полям как к настоящим нодам поля', () => {
    const form = makeForm();

    expect(isFormControl(form.$.value)).toBe(true);
    expect(form.$.value.value.value).toBe('raw');
    expect(isFormControl(form.$.issues)).toBe(true);
    expect(form.$.issues.value.value).toBe('none');
  });

  it('form.$.<field>.setValue меняет значение затенённого поля', () => {
    const form = makeForm();

    form.$.value.setValue('changed');
    expect(form.$.value.value.value).toBe('changed');
    expect(form.value.value.value).toBe('changed');
  });

  it('id, status, fields, submit — поля данных, а не члены ноды', () => {
    interface Order {
      id: string;
      status: string;
      fields: string;
      submit: string;
      items: string;
    }
    const model = createModel<Order>({
      id: 'o-1',
      status: 'new',
      fields: 'f',
      submit: 's',
      items: 'i',
    });
    const form = createFormFromModel<Order>({ model });

    for (const name of ['id', 'status', 'fields', 'submit', 'items'] as const) {
      expect(isFormControl(form[name]), name).toBe(true);
      expect(form[name]).toBe(form.$[name]);
    }
    expect(form.status.value.value).toBe('new');
    form.id.setValue('o-2');
    expect(model.id).toBe('o-2');
  });

  it('внутренние методы класса не затеняют поле данных', () => {
    interface Internals {
      dispose: string;
      children: string;
      proxy: string;
    }
    const model = createModel<Internals>({ dispose: 'd', children: 'c', proxy: 'p' });
    const form = createFormFromModel<Internals>({ model });

    expect(isFormControl(form.dispose)).toBe(true);
    expect(isFormControl(form.children)).toBe(true);
    expect(form.proxy.value.value).toBe('p');
    // Методы группы работают и при таком поле: они привязаны к классу, а не к прокси с полями.
    form.reset({ dispose: 'x', children: 'y', proxy: 'z' });
    expect(model.get()).toEqual({ dispose: 'x', children: 'y', proxy: 'z' });
    expect(form.getValue()).toEqual({ dispose: 'x', children: 'y', proxy: 'z' });
  });

  it('незатенённые поля доступны и напрямую, и через form.$', () => {
    const form = makeForm();

    expect(isFormControl(form.email)).toBe(true);
    expect(form.email.value.value).toBe('e@x.com');
    expect(form.$.email).toBe(form.email);
  });

  it("'$' виден через оператор in, поля — тоже", () => {
    const form = makeForm();
    expect('$' in form).toBe(true);
    expect('email' in form).toBe(true);
  });

  it('прямое присваивание полю запрещено', () => {
    const form = makeForm() as unknown as Record<string, unknown>;
    expect(() => {
      'use strict';
      form.email = 'x';
    }).toThrow(TypeError);
  });
});

/** Все члены контракта FormNode — каждый затеняет одноимённое поле данных. */
const NODE_MEMBERS = [
  'value',
  'valid',
  'invalid',
  'pending',
  'disabled',
  'touched',
  'dirty',
  'issues',
  'ownIssues',
  'getValue',
  'setValue',
  'reset',
  'markAsTouched',
  'markAsUntouched',
  'enable',
  'disable',
  'setIssues',
  'clearIssues',
] as const;

type MemberName = (typeof NODE_MEMBERS)[number];

describe('FormGroup — каждый член FormNode затеняет поле данных', () => {
  const initial = Object.fromEntries(NODE_MEMBERS.map((name) => [name, `field:${name}`])) as Record<
    MemberName,
    string
  >;

  it.each(NODE_MEMBERS)('%s: точкой — член ноды, через $ — поле', (name) => {
    const form = createFormFromModel<Record<MemberName, string>>({
      model: createModel(initial),
    });
    const member = (form as unknown as Record<string, unknown>)[name];

    expect(member).not.toBe(form.$[name]);
    expect(isFormControl(member)).toBe(false);
    expect(isFormControl(form.$[name])).toBe(true);
    expect(form.$[name].value.value).toBe(`field:${name}`);
  });
});

describe('FormGroup — ловушки прокси: set', () => {
  it('присвоить $ и член контракта нельзя: TypeError, член остаётся прежним', () => {
    const form = makeForm();
    const face = form as unknown as Record<string, unknown>;
    const valid = form.valid;

    expect(() => {
      face.$ = {};
    }).toThrow(TypeError);
    expect(() => {
      face.valid = 'x';
    }).toThrow(TypeError);
    expect(() => {
      face.reset = () => {};
    }).toThrow(TypeError);
    expect(form.valid).toBe(valid);
    expect(isFormControl(form.$.email)).toBe(true);
  });

  it('незнакомое имя записывается на сырой узел и читается через лицо', () => {
    const form = makeForm();
    const face = form as unknown as Record<PropertyKey, unknown>;
    const tag = Symbol('tag');

    face.custom = 42;
    face[tag] = 'marked';

    expect(face.custom).toBe(42);
    expect(face[tag]).toBe('marked');
    expect((rawNode(form) as unknown as Record<PropertyKey, unknown>).custom).toBe(42);
  });
});

describe('FormGroup — ловушки прокси: has, ownKeys, getOwnPropertyDescriptor', () => {
  it('in видит поля, члены контракта, методы класса и метку вида; незнакомое имя — нет', () => {
    const form = makeForm();

    for (const name of ['email', 'status', 'valid', 'reset', 'dispose', NODE_KIND]) {
      expect(name in form, String(name)).toBe(true);
    }
    expect('nonexistent' in form).toBe(false);
  });

  it('ownKeys: поля и члены сырого узла без повторов, даже если поле названо как член', () => {
    const form = makeForm();

    const keys = Reflect.ownKeys(form);

    expect(keys).toEqual(expect.arrayContaining(['email', 'status', 'id', 'value', 'valid']));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => key === 'value')).toHaveLength(1);
  });

  it('Object.keys(form.$) — ровно поля группы; Object.keys(form) — ещё и члены класса', () => {
    const form = makeForm();

    expect(Object.keys(form.$)).toEqual(['value', 'issues', 'status', 'id', 'email']);
    // поведение под вопросом [ReFormer-9qqx]: перечисление лица отдаёт и внутренности класса (`children`, `own`,
    // `leafSignals`, …) — ловушка ownKeys берёт собственные ключи сырого узла целиком. Поля
    // группы перечисляет `form.$`.
    expect(Object.keys(form)).toEqual(expect.arrayContaining(['email', 'children', 'own']));
  });

  it('дескриптор поля — нода поля, перечислимая; члена класса — его сигнал; метода — нет', () => {
    const form = makeForm();

    expect(Object.getOwnPropertyDescriptor(form, 'email')).toMatchObject({
      value: form.email,
      enumerable: true,
      configurable: true,
    });
    expect(Object.getOwnPropertyDescriptor(form, 'valid')?.value).toBe(form.valid);
    expect(Object.getOwnPropertyDescriptor(form, 'reset')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(form, 'nonexistent')).toBeUndefined();
  });

  it('дескриптор поля, затенённого членом, — нода поля, а чтение точкой — член', () => {
    const form = makeForm();

    // поведение под вопросом [ReFormer-9qqx]: ловушка getOwnPropertyDescriptor проверяет поля раньше членов
    // контракта, а get — наоборот. Поэтому `getOwnPropertyDescriptor(form, 'value').value` —
    // нода поля, а `form.value` — сигнал значения группы. Спред и Object.entries идут через get.
    expect(Object.getOwnPropertyDescriptor(form, 'value')?.value).toBe(form.$.value);
    expect(form.value).not.toBe(form.$.value);
    expect({ ...form }.value).toBe(form.value);
  });
});

describe('FormGroup — пространство $ и методы, привязанные к сырому узлу', () => {
  it('$ — замороженный словарь, один на группу; вложенная группа в нём — её лицо', () => {
    const model = createModel({ name: '', address: { city: '' } });
    const form = createFormFromModel({ model });

    expect(form.$).toBe(form.$);
    expect(Object.isFrozen(form.$)).toBe(true);
    expect(form.$.address).toBe(form.address);
    expect(isFormGroup(form.$.address)).toBe(true);
  });

  it('метод — одна и та же функция при каждом чтении', () => {
    const form = makeForm();

    expect(form.reset).toBe(form.reset);
    expect(form.getValue).toBe(form.getValue);
    expect(form.markAsTouched).toBe(form.markAsTouched);
    expect((form as unknown as { dispose: unknown }).dispose).toBe(
      (form as unknown as { dispose: unknown }).dispose
    );
  });

  it('у разных групп — разные функции, каждая про свою группу', () => {
    const first = makeForm();
    const second = makeForm();

    expect(first.reset).not.toBe(second.reset);

    const { markAsTouched } = first;
    markAsTouched();

    expect(first.touched.value).toBe(true);
    expect(second.touched.value).toBe(false);
  });

  it('методы работают отдельно от лица: this — сырой узел', () => {
    const form = makeForm();
    const { setValue, getValue, reset } = form;

    setValue({ value: 'v', issues: 'i', status: 's', id: 'x', email: 'm' });
    expect(getValue()).toEqual({ value: 'v', issues: 'i', status: 's', id: 'x', email: 'm' });

    reset();
    expect(getValue()).toMatchObject({ value: 'raw', email: 'e@x.com' });
  });

  it('сигнал-член отдаётся как есть — тот же объект, что у сырого узла', () => {
    const form = makeForm();

    expect(form.valid).toBe(rawNode(form).valid);
    expect(form.issues).toBe(rawNode(form).issues);
  });
});
