/**
 * Учёт ключей intent: ни один ключ записи не пропадает молча (аудит 2026-11, B1).
 *
 * Чтение отмечает взятые ключи каждой записи. Остаток — либо известное не на своём месте (свойство
 * компонента рядом с полем поднимается в `componentProps` с заметкой), либо проблема `unknown-key` с
 * ближайшим допустимым ключом. Синоним рядом с каноном и с другим значением — `key-conflict`.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { readIntent, type IntentReading } from '../src/core/generate/form-intent';
import { GRAMMAR_EXAMPLE } from '../src/core/generate/intent-grammar';

const read = (raw: unknown): IntentReading =>
  readIntent(raw, { uiKit: CATALOGS.uiKit, uiKitProps: CATALOGS.uiKitProps });

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Короткая форма: одно поле на корне. */
const form = (field: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  formName: 'Sign-up',
  target: 'renderer-react',
  fields: [{ name: 'email', type: 'string', component: 'Input', label: 'Email', ...field }],
  layoutRoot: { kind: 'container', component: 'Box', children: ['email'] },
  ...extra,
});

describe('readIntent: незнакомый ключ — проблема с подсказкой', () => {
  it('опечатка ключа поля называет ближайший ключ', () => {
    const { problems } = read(form({ lable: 'E-mail' }));
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'unknown-key',
        at: 'fields[0].lable',
        message: expect.stringContaining('did you mean `label`?'),
      }),
    ]);
  });

  it('ключ без похожего называет ключи записи', () => {
    const { problems } = read(form({ zzz: 1 }));
    expect(problems[0]).toMatchObject({ code: 'unknown-key', at: 'fields[0].zzz' });
    expect(problems[0].message).not.toContain('did you mean');
    expect(problems[0].expected).toContain('name, type, component, label');
  });

  it('каждый вид записи учитывает свои ключи', () => {
    const raw = {
      ...form({}),
      extraTop: 1,
      arrays: [{ name: 'items', itemFields: [{ name: 'qty', type: 'number', bogus: 1 }], junk: 1 }],
      validation: [{ target: 'email', rules: ['required()'], hint: 'x' }],
      behavior: [{ kind: 'syncFields', target: 'email', sources: ['email'], extra: 1 }],
      visibility: [{ selector: 'email', condition: 'true', also: 1 }],
      dataSources: [{ name: 'CODES', values: [], color: 'red' }],
    };
    const at = read(raw)
      .problems.filter((p) => p.code === 'unknown-key')
      .map((p) => p.at)
      .sort();
    expect(at).toEqual(
      [
        'intent.extraTop',
        'arrays[0].junk',
        'arrays[0].itemFields[0].bogus',
        'validation[0].hint',
        'behavior[0].extra',
        'visibility[0].also',
        'dataSources[0].color',
      ].sort()
    );
  });

  it('ключ в другом регистре — тот же ключ, с заметкой о переименовании', () => {
    const { intent, problems, notices } = read(form({ Label: 'E-mail', label: undefined }));
    expect(problems).toEqual([]);
    expect(intent.fields[0].label).toBe('E-mail');
    expect(notices.map((n) => n.message).join('\n')).toContain('Label → label');
  });

  it('синоним с другим значением — конфликт, с тем же — молча', () => {
    expect(read(form({ title: 'Почта' })).problems).toEqual([
      expect.objectContaining({ code: 'key-conflict', at: 'fields[0].title' }),
    ]);
    expect(read(form({ title: 'Email' })).problems).toEqual([]);
  });

  it('значение не того вида — проблема, а не тихое «нет»', () => {
    const { problems } = read(form({ label: { en: 'Email' }, selector: 7 }));
    expect(problems.map((p) => [p.code, p.at])).toEqual([
      ['invalid-value', 'fields[0].label'],
      ['invalid-value', 'fields[0].selector'],
    ]);
  });
});

describe('readIntent: известное не на своём месте поднимается', () => {
  it('свойство компонента рядом с полем — в componentProps с заметкой', () => {
    const { intent, problems, notices } = read(form({ placeholder: 'you@mail.com' }));
    expect(problems).toEqual([]);
    expect(intent.fields[0].componentProps).toEqual({ placeholder: 'you@mail.com' });
    expect(notices.map((n) => n.code)).toContain('prop-lifted');
  });

  it('min у числа — свойство поля ввода и подсказка про правило', () => {
    const { intent, notices } = read(
      form({ name: 'age', type: 'number', component: 'InputNumber', min: 18 })
    );
    expect(intent.fields[0].componentProps).toEqual({ min: 18 });
    expect(notices.find((n) => n.code === 'prop-lifted')?.message).toContain('min(…)');
  });

  it('свойство, которого у компонента нет, — проблема с перечнем его свойств', () => {
    const { problems } = read(form({ hint: 'Рабочая почта' }));
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'prop-unsupported',
        at: 'fields[0].hint',
        expected: expect.stringContaining('description'),
      }),
    ]);
  });

  it('свойство рядом и в componentProps с разными значениями — конфликт', () => {
    const { problems } = read(form({ placeholder: 'a', componentProps: { placeholder: 'b' } }));
    expect(problems.map((p) => p.code)).toEqual(['key-conflict']);
  });

  it('без схем кита поднимаются общеизвестные свойства, прочее — unknown-key', () => {
    const { intent, problems } = readIntent(form({ placeholder: 'x', zzz: 1 }));
    expect(intent.fields[0].componentProps).toEqual({ placeholder: 'x' });
    expect(problems.map((p) => [p.code, p.at])).toEqual([['unknown-key', 'fields[0].zzz']]);
  });

  it('title секции и submitLabel мастера — в пропсы контейнеров', () => {
    const raw = {
      formName: 'Loan',
      fields: [{ name: 'a', type: 'string', component: 'Input', label: 'A' }],
      layoutRoot: {
        kind: 'container',
        component: 'FormWizard',
        submitLabel: 'Send',
        children: [
          {
            kind: 'step',
            title: 'One',
            children: [{ kind: 'container', component: 'Section', title: 'Main', children: ['a'] }],
          },
        ],
      },
    };
    const { intent, problems } = read(raw);
    expect(problems).toEqual([]);
    const root = intent.layoutRoot as Extract<typeof intent.layoutRoot, { kind: 'container' }>;
    expect(root.componentProps).toEqual({ submitLabel: 'Send' });
    const step = root.children[0] as Extract<typeof intent.layoutRoot, { kind: 'step' }>;
    expect(step.children[0]).toMatchObject({
      component: 'Section',
      componentProps: { title: 'Main' },
    });
  });

  it('свойства мастера в записи wizard — к корню из сокращения steps', () => {
    const { intent, problems } = read({
      formName: 'Loan',
      fields: [{ name: 'a', type: 'string', component: 'Input', label: 'A' }],
      wizard: { submitLabel: 'Send', steps: [{ title: 'One', fields: ['a'] }] },
    });
    expect(problems).toEqual([]);
    expect(intent.layoutRoot).toMatchObject({
      component: 'FormWizard',
      componentProps: { submitLabel: 'Send' },
    });
  });

  it('свойства FieldArray рядом с массивом — в его componentProps', () => {
    const { intent, problems } = read({
      formName: 'Order',
      arrays: [
        {
          name: 'items',
          addButtonLabel: '+ Add item',
          itemFields: [{ name: 'qty', type: 'number', component: 'InputNumber', label: 'Qty' }],
        },
      ],
    });
    expect(problems).toEqual([]);
    expect(intent.arrays[0].componentProps).toEqual({ addButtonLabel: '+ Add item' });
  });

  it('required строкой — с заметкой; иное значение — проблема', () => {
    const coerced = read(form({ required: 'true' }));
    expect(coerced.problems).toEqual([]);
    expect(coerced.intent.validation).toEqual([{ target: 'email', rules: ['required()'] }]);
    expect(coerced.notices.map((n) => n.code)).toContain('value-coerced');
    expect(read(form({ required: 'yes' })).problems.map((p) => p.code)).toEqual(['invalid-value']);
  });

  it('validation на самом поле — правилами в validation', () => {
    const { intent, problems } = read(form({ validation: ['required()', 'email()'] }));
    expect(problems).toEqual([]);
    expect(intent.validation).toEqual([{ target: 'email', rules: ['required()', 'email()'] }]);
    const records = read(
      form({ validation: [{ rules: ['required()'], message: 'Enter the email' }] })
    );
    expect(records.problems).toEqual([]);
    expect(records.intent.validation).toEqual([
      { target: 'email', rules: ['required()'], message: 'Enter the email' },
    ]);
  });

  it('числовой параметр замечания — выражение строкой; объект — проблема', () => {
    const rule = { target: 'email', cross: 'values.email !== ""', params: { max: 10 } };
    const { intent, problems } = read(form({}, { validation: [rule] }));
    expect(problems).toEqual([]);
    expect(intent.validation[0].params).toEqual({ max: '10' });
    const bad = read(form({}, { validation: [{ ...rule, params: { max: { a: 1 } } }] }));
    expect(bad.problems.map((p) => [p.code, p.at])).toEqual([
      ['invalid-value', 'validation[0].params.max'],
    ]);
  });

  it('severity, кроме error и warning, — проблема', () => {
    const rule = { target: 'email', cross: 'true', severity: 'info' };
    expect(read(form({}, { validation: [rule] })).problems.map((p) => p.at)).toEqual([
      'validation[0].severity',
    ]);
  });
});

describe('readIntent: списки словарём и описания на месте', () => {
  it('валидация словарём {путь: правила}', () => {
    const { intent, problems } = read(
      form(
        {},
        {
          validation: { email: ['required()', 'email()'] },
        }
      )
    );
    expect(problems).toEqual([]);
    expect(intent.validation).toEqual([{ target: 'email', rules: ['required()', 'email()'] }]);
  });

  it('словарь правил не теряется, когда правила переносятся с полей', () => {
    const { intent, problems } = read(
      form({ rules: ['email()'] }, { validation: { email: ['required()'] } })
    );
    expect(problems).toEqual([]);
    expect(intent.validation.flatMap((v) => v.rules).sort()).toEqual(['email()', 'required()']);
  });

  it('поля словарём с сокращением типа; место записи — по имени', () => {
    const { intent, problems } = read({
      formName: 'Short',
      fields: { email: 'string', age: { type: 'number', component: 'InputNumber', lable: 'Age' } },
    });
    expect(intent.fields.map((f) => [f.name, f.type])).toEqual([
      ['email', 'string'],
      ['age', 'number'],
    ]);
    expect(problems.map((p) => p.at)).toEqual(['fields.age.lable']);
  });

  it('справочник значений словарём — вариантами { value, label }', () => {
    const { intent, problems } = read(
      form({}, { dataSources: [{ name: 'CODES', values: { a: 'Alpha' } }] })
    );
    expect(problems).toEqual([]);
    expect(intent.dataSources[0].values).toEqual([{ value: 'a', label: 'Alpha' }]);
  });

  it('описание на месте дописывает объявление, расхождение — конфликт', () => {
    const base = {
      formName: 'Merge',
      fields: [{ name: 'email', type: 'string', component: 'Input' }],
    };
    const merged = read({
      ...base,
      layoutRoot: {
        kind: 'container',
        children: [{ kind: 'field', ref: 'email', label: 'Email' }],
      },
    });
    expect(merged.problems).toEqual([]);
    expect(merged.intent.fields[0].label).toBe('Email');
    expect(merged.notices.map((n) => n.code)).toContain('inline-merged');

    const clash = read({
      ...base,
      layoutRoot: {
        kind: 'container',
        children: [{ kind: 'field', ref: 'email', component: 'Textarea' }],
      },
    });
    expect(clash.problems.map((p) => [p.code, p.at])).toEqual([
      ['key-conflict', 'layoutRoot.children[0].component'],
    ]);
  });

  it('селектор узла поля — селектор поля в объявлении', () => {
    const { intent, problems } = read({
      formName: 'Selector',
      fields: [{ name: 'email', type: 'string', component: 'Input', label: 'Email' }],
      layoutRoot: {
        kind: 'container',
        children: [{ kind: 'field', ref: 'email', selector: 'mail' }],
      },
    });
    expect(problems).toEqual([]);
    expect(intent.fields[0].selector).toBe('mail');
  });

  it('правила узлов отдельным списком nodes читаются', () => {
    const { intent, problems } = read(
      form({}, { nodes: [{ kind: 'onMount', selector: 'root', expr: 'focus()' }] })
    );
    expect(problems).toEqual([]);
    expect(intent.nodes).toEqual([{ kind: 'onMount', selector: 'root', expr: 'focus()' }]);
  });

  it('массив с type: "array" — массив; с другим типом — проблема', () => {
    const items = { name: 'items', itemFields: [{ name: 'qty', type: 'number' }] };
    expect(read({ formName: 'A', arrays: [{ ...items, type: 'array' }] }).problems).toEqual([]);
    expect(
      read({ formName: 'A', arrays: [{ ...items, type: 'string' }] }).problems.map((p) => p.at)
    ).toEqual(['arrays[0].type']);
  });

  it('layout строкой — только режим файлов; дерево и в layout, и в layoutRoot — конфликт', () => {
    expect(read(form({}, { layout: 'vertical' })).problems.map((p) => p.at)).toEqual(['layout']);
    expect(
      read(form({}, { layout: { kind: 'container', children: ['email'] } })).problems.map(
        (p) => p.code
      )
    ).toEqual(['key-conflict']);
    expect(read(form({}, { layout: 'folders' })).problems).toEqual([]);
  });

  it('шаги без заголовка — проблема, а не безымянный шаг', () => {
    const { problems } = read({
      formName: 'Steps',
      fields: [{ name: 'a', type: 'string', component: 'Input', label: 'A' }],
      steps: [{ fields: ['a'] }],
    });
    expect(problems.map((p) => [p.code, p.at])).toEqual([['missing-key', 'steps[0].title']]);
  });

  it('steps рядом с другой раскладкой — заметка; тот же intent, прочитанный обратно, — без неё', () => {
    const steps = { steps: [{ title: 'One', fields: ['email'] }] };
    const once = read({ ...form({}), layoutRoot: undefined, ...steps });
    expect(once.problems).toEqual([]);
    const again = read(clone(once.intent));
    expect(again.problems).toEqual([]);
    expect(again.notices.map((n) => n.code)).not.toContain('steps-ignored');
    const differs = read({ ...form({}), ...steps });
    expect(differs.notices.map((n) => n.code)).toContain('steps-ignored');
  });
});

describe('readIntent: правило на путь поля строки', () => {
  it('contacts.phone без each — правило каждой строки с заметкой [ReFormer-j356.11]', () => {
    const raw: Record<string, unknown> = {
      ...clone(GRAMMAR_EXAMPLE),
      validation: [{ target: 'contacts.phone', rules: ["required({ code: 'phone' })"] }],
    };
    const { intent, problems, notices } = read(raw);
    expect(problems).toEqual([]);
    expect(intent.validation[0]).toMatchObject({ target: 'phone', each: 'contacts' });
    expect(notices.map((n) => n.code)).toContain('each-lifted');
  });
});

describe('readIntent: образец грамматики читается целиком', () => {
  it('каждый ключ образца потреблён: ни проблем, ни заметок о ключах', () => {
    const { problems, notices } = read(clone(GRAMMAR_EXAMPLE));
    expect(problems).toEqual([]);
    const codes = new Set(notices.map((n) => n.code));
    for (const code of ['keys-renamed', 'prop-lifted', 'list-as-map'] as const) {
      expect(codes.has(code)).toBe(false);
    }
  });
});

/**
 * Места образца, куда fuzz кладёт лишний ключ. Каждое — запись, которую читает своя функция
 * чтения: поле, строка массива, массив, правило, поведение, правило узла, видимость, справочник,
 * узлы разметки разных видов и часть.
 */
const SITES: ReadonlyArray<ReadonlyArray<string | number>> = [
  [],
  ['fields', 0],
  ['fields', 5],
  ['arrays', 0],
  ['arrays', 0, 'itemFields', 1],
  ['validation', 0],
  ['validation', 4],
  ['behavior', 0],
  ['behavior', 14],
  ['visibility', 0],
  ['dataSources', 0],
  ['layoutRoot'],
  ['layoutRoot', 'children', 0],
  ['layoutRoot', 'children', 0, 'children', 5],
  ['layoutRoot', 'children', 1, 'children', 7],
  ['layoutRoot', 'children', 1, 'children', 13],
  ['parts', 'address'],
];

/** Запись документа по пути: записи образца — объекты и списки объектов. */
function recordAt(doc: unknown, path: ReadonlyArray<string | number>): Record<string, unknown> {
  let node: unknown = doc;
  for (const step of path) node = (node as Record<string | number, unknown>)[step];
  return node as Record<string, unknown>;
}

describe('fuzz: лишний ключ никогда не проходит молча', () => {
  const key = fc.stringMatching(/^[a-z][A-Za-z0-9]{2,10}$/).map((k) => `zq${k}`);
  const value = fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.array(fc.integer(), { maxLength: 3 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 4 }), fc.integer(), { maxKeys: 2 })
  );

  it('любой лишний ключ любой записи — проблема или заметка с его именем', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: SITES.length - 1 }), key, value, (site, k, v) => {
        const intent: unknown = clone(GRAMMAR_EXAMPLE);
        const record = recordAt(intent, SITES[site]);
        if (record === undefined || typeof record !== 'object') return;
        record[k] = v;
        const { problems, notices } = read(intent);
        const heard =
          problems.some((p) => p.at.endsWith(`.${k}`) || p.message.includes(k)) ||
          notices.some((n) => n.message.includes(k));
        // `null` — отсутствие значения, а не потеря: ключ с ним промолчать вправе.
        expect(heard || v === null).toBe(true);
      }),
      { numRuns: 300 }
    );
  });
});
