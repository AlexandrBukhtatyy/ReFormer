import {
  DOCUMENT_GRAMMAR_EXAMPLE,
  DOCUMENT_GRAMMAR_LIMIT,
  INTENT_CONTRACT_VERSION,
  intentGrammar,
} from '@reformer/mcp/intent';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { describe, expect, it } from 'vitest';
import { builtinEntries } from '../../../core/testing';
import { builtinKit } from '../../../core/codegen/__fixtures__/kit';
import { prepare } from '../../../core/codegen/context';
import { readRulesFromCode } from '../../../core/codegen/rules-code';
import { behaviorView } from '../../../core/codegen/view/behavior';
import { collectModelPaths, emptyRules, emptySchema, getAt } from '../../../core/form-model';
import { buildOutline } from '../model/outline';
import { wizardNames } from '../model/catalog-digest';
import type { ToolContext, ToolOutcome } from '../model/types';
import { buildFormTool } from './build-form';
import { BUILD_FORM_STEPS_EXAMPLE, buildFormGrammar, catalogsOf } from './build-form/grammar';
import { insertNodeTool } from './insert-node';
import { createEditorToolRegistry } from './registry';
import { structuredSlots } from '.';
import { systemPrompt } from '../loop/prompt';
import { buildFormEmptySeed, formSeed } from '../stack/seed';
import { PROMPT_BUDGET } from '../model/types';

const catalog = builtinEntries();
const kit = wizardNames(catalog);

/**
 * Форма заказа — прежний образец грамматики билдера. Грамматика теперь из MCP
 * (`DOCUMENT_GRAMMAR_EXAMPLE`), а этот intent остался фикстурой сборки по шагам: в нём поля двух
 * шагов, правило между шагами, связи, массив, видимость и справочник.
 */
const ORDER_FORM = {
  fields: [
    { name: 'email', component: 'Input', label: 'Email', required: true },
    { name: 'kind', component: 'Select', label: 'Client type', optionsSource: 'KINDS' },
    { name: 'inn', component: 'Input', label: 'INN' },
    { name: 'sameEmail', component: 'Checkbox', label: 'Send the invoice to the same email' },
    { name: 'billingEmail', component: 'Input', label: 'Invoice email' },
    { name: 'price', component: 'InputNumber', label: 'Price' },
    { name: 'qty', component: 'InputNumber', label: 'Quantity' },
    { name: 'total', component: 'InputNumber', label: 'Total' },
  ],
  arrays: [
    {
      name: 'children',
      componentProps: { title: 'Children' },
      itemFields: [{ name: 'name', component: 'Input', label: 'Name', required: true }],
    },
  ],
  validation: [
    { target: 'email', rules: ['email'] },
    { target: 'inn', rules: ['required'], when: "model.kind === 'company'" },
    { target: 'qty', rules: ['min(1)', 'max(100)'] },
    {
      target: 'billingEmail',
      cross: 'values.billingEmail !== values.inn',
      message: 'Must differ from INN',
    },
  ],
  behavior: [
    {
      kind: 'compute',
      target: 'total',
      sources: ['price', 'qty'],
      expr: '(model.price ?? 0) * (model.qty ?? 0)',
    },
    {
      kind: 'copyFrom',
      target: 'billingEmail',
      sources: ['email'],
      expr: 'model.sameEmail === true',
    },
    { kind: 'enableWhen', target: 'inn', sources: ['kind'], expr: "model.kind === 'company'" },
  ],
  visibility: [{ selector: 'billingEmail', condition: 'model.sameEmail === true' }],
  dataSources: [
    {
      name: 'KINDS',
      values: [
        { value: 'person', label: 'Person' },
        { value: 'company', label: 'Company' },
      ],
    },
  ],
};

const ctxOf = (draft: JsonFormSchema, base = draft, rules = emptyRules()): ToolContext => ({
  draft,
  base,
  rules,
  catalog,
  validateForm: validateFormSchema,
});

const build = (params: Record<string, unknown>, ctx = ctxOf(emptySchema())) =>
  buildFormTool.run(params as never, ctx);

function expectBuilt(out: ToolOutcome): { schema: JsonFormSchema; out: ToolOutcome } {
  expect(out.error?.code, out.text).toBeUndefined();
  expect(out.schema).toBeDefined();
  return { schema: out.schema as JsonFormSchema, out };
}

/** Узлы шагов визарда схемы по порядку. */
function stepsOf(schema: JsonFormSchema) {
  return buildOutline(schema).filter((e) => e.component === kit?.step);
}

describe('build_form', () => {
  it('без intent отдаёт грамматику с именами полей кита', async () => {
    const out = await build({});
    expect(out.ok).toBe(true);
    expect(out.schema).toBeUndefined();
    expect(out.text).toContain('# intent — grammar');
    expect(out.text).toContain('## Where it lands');
    expect(out.text).toContain('InputNumber');
  });

  it('пример грамматики MCP собирается на ките: поля, строки, правила, опции связей, видимость', async () => {
    const { schema, out } = expectBuilt(await build({ intent: DOCUMENT_GRAMMAR_EXAMPLE }));
    const paths = collectModelPaths(schema);
    for (const name of ['loanType', 'price', 'total', 'propertyValue', 'residenceAddress.city']) {
      expect(paths).toContain(name);
    }
    expect(JSON.stringify(schema)).toContain('$model(phone)');
    expect(out.rules?.validation.map((r) => r.target)).toEqual(
      expect.arrayContaining(['price', 'propertyValue', 'contacts.phone', 'confirm'])
    );
    expect(out.rules?.behavior.map((b) => b.kind)).toEqual([
      'compute',
      'enableWhen',
      'copyFrom',
      'onChange',
    ]);
    // Опции связи доходят до правил: раньше `behaviorIntent` их молча терял (аудит 2026-11, D4).
    expect(out.rules?.behavior[1]).toMatchObject({ options: { resetOnDisable: true } });
    expect(out.rules?.render).toEqual([
      expect.objectContaining({ kind: 'hideWhen', condition: "model.loanType !== 'mortgage'" }),
    ]);
    expect(out.rules?.dataSources?.LOAN_TYPES).toHaveLength(2);
  });

  it('цель compute встаёт выключенным полем, прочие поля — нет', async () => {
    // MCP блокирует вычисляемое поле ключом узла `disabled` (ReFormer-j356.6).
    const { schema } = expectBuilt(await build({ intent: DOCUMENT_GRAMMAR_EXAMPLE }));
    const nodes: Array<Record<string, unknown>> = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === 'object') {
        nodes.push(value as Record<string, unknown>);
        Object.values(value).forEach(walk);
      }
    };
    walk(schema);
    const fieldNode = (path: string) => nodes.find((n) => n.model === `$model(${path})`);
    expect(fieldNode('total')).toMatchObject({ disabled: true });
    expect(fieldNode('price')).not.toHaveProperty('disabled');
  });

  it('пример шагов грамматики — визард кита с пустыми шагами и их адресами', async () => {
    const { schema, out } = expectBuilt(await build({ intent: BUILD_FORM_STEPS_EXAMPLE }));
    const wizard = getAt(schema, ['root', 'children', 0]) as { component: string };
    expect(wizard.component).toBe(`$component(${kit?.wizard})`);
    expect(stepsOf(schema)).toHaveLength(2);
    expect(out.text).toContain(
      'Steps: "Client" /root/children/0/children/0; "Order" /root/children/0/children/1.'
    );
  });

  it('визард с полями до шести шагов собирается одним intent', async () => {
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'a', component: 'Input', label: 'A' },
            { name: 'b', component: 'Input', label: 'B' },
          ],
          steps: [
            { title: 'One', fields: ['a'] },
            { title: 'Two', fields: ['b'] },
          ],
        },
      })
    );
    expect(stepsOf(schema)).toHaveLength(2);
    expect(collectModelPaths(schema)).toEqual(['a', 'b']);
    expect(out.text).toContain('Steps: "One"');
  });

  it('визард крупнее предела — отказ с первым вызовом по шагам, форма цела', async () => {
    const titles = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const out = await build({
      intent: {
        fields: titles.map((t) => ({ name: t.toLowerCase(), component: 'Input', label: t })),
        steps: titles.map((t) => ({ title: t, fields: [t.toLowerCase()] })),
      },
    });
    expect(out.ok).toBe(false);
    expect(out.schema).toBeUndefined();
    expect(out.text).toContain('wizard-too-large');
    expect(out.text).toContain(JSON.stringify({ steps: titles.map((title) => ({ title })) }));
  });

  it('форма по шагам: шаги, затем поля и правила каждого шага в его адрес', async () => {
    const steps = expectBuilt(await build({ intent: BUILD_FORM_STEPS_EXAMPLE }));
    const [client, order] = stepsOf(steps.schema).map((entry) => entry.ref);
    const { fields, arrays, validation, behavior, visibility, dataSources } = ORDER_FORM;
    const first = expectBuilt(
      await build(
        {
          parent: client,
          intent: {
            fields: fields.slice(0, 3),
            validation: validation.slice(0, 2),
            behavior: [behavior[2]],
            dataSources,
          },
        },
        ctxOf(steps.schema, emptySchema(), steps.out.rules)
      )
    );
    const second = expectBuilt(
      await build(
        {
          parent: order,
          intent: {
            fields: fields.slice(3),
            arrays,
            validation: validation.slice(2),
            behavior: behavior.slice(0, 2),
            visibility,
          },
        },
        ctxOf(first.schema, emptySchema(), first.out.rules)
      )
    );
    expect(stepsOf(second.schema)).toHaveLength(2);
    expect(collectModelPaths(second.schema)).toEqual(
      expect.arrayContaining(['email', 'kind', 'inn', 'price', 'total', 'billingEmail'])
    );
    // Правило второго шага называет поле первого: inn построен раньше.
    expect(second.out.rules?.validation.map((r) => r.target)).toEqual(
      expect.arrayContaining(['email', 'inn', 'qty', 'billingEmail'])
    );
    expect(second.out.rules?.behavior.map((b) => b.kind)).toEqual([
      'enableWhen',
      'compute',
      'copyFrom',
    ]);
  });

  it('поля без шага в визард — один шаг с заголовком intent (запись B.2)', async () => {
    const steps = expectBuilt(await build({ intent: BUILD_FORM_STEPS_EXAMPLE }));
    const { schema, out } = expectBuilt(
      await build(
        {
          parent: '/root/children/0',
          intent: {
            title: 'Доставка',
            fields: [{ label: 'Город', model: 'city', required: true, type: 'text' }],
          },
        },
        ctxOf(steps.schema, emptySchema(), steps.out.rules)
      )
    );
    expect(stepsOf(schema)).toHaveLength(3);
    expect(collectModelPaths(schema)).toEqual(['city']);
    expect(out.text).toContain('Steps: "Доставка" /root/children/0/children/2.');
    expect(out.text).not.toContain('компонент не указан');
  });

  it('один шаг с полями собирается сразу — и в готовый визард', async () => {
    const steps = expectBuilt(await build({ intent: BUILD_FORM_STEPS_EXAMPLE }));
    const wizard = '/root/children/0';
    const { schema } = expectBuilt(
      await build(
        {
          parent: wizard,
          intent: {
            fields: [{ name: 'city', component: 'Input', label: 'City' }],
            steps: [{ title: 'Delivery', fields: ['city'] }],
          },
        },
        ctxOf(steps.schema, emptySchema(), steps.out.rules)
      )
    );
    expect(stepsOf(schema)).toHaveLength(3);
    expect(collectModelPaths(schema)).toEqual(['city']);
  });

  it('форма без шагов: корневой Box intent разворачивается в корень формы', async () => {
    const { schema } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'a', component: 'Input', label: 'A' },
            { name: 'b', component: 'Input', label: 'B' },
          ],
        },
      })
    );
    const root = getAt(schema, ['root']) as { children: unknown[] };
    expect(root.children).toHaveLength(2);
  });

  it('шаг без полей и затем поля в шаг по адресу из ответа', async () => {
    const first = expectBuilt(
      await build({
        intent: {
          fields: [],
          steps: [
            { title: 'One', fields: [] },
            { title: 'Two', fields: [] },
          ],
        },
      })
    );
    const step = stepsOf(first.schema)[1].ref;
    const second = expectBuilt(
      await build(
        {
          parent: step,
          intent: {
            fields: [{ name: 'phone', component: 'Input', label: 'Phone', required: true }],
          },
        },
        ctxOf(first.schema, emptySchema(), first.out.rules)
      )
    );
    expect(collectModelPaths(second.schema)).toContain('phone');
    expect(second.out.rules?.validation).toEqual([
      // `required: true` поля MCP поднимает в правило — тем же вызовом, что печатает генерация.
      expect.objectContaining({ target: 'phone', rules: ['required()'] }),
    ]);
  });

  it('повторный вызов без parent на пустой на начало хода форме пересобирает её', async () => {
    const first = expectBuilt(
      await build({ intent: { fields: [{ name: 'a', component: 'Input', label: 'A' }] } })
    );
    const again = expectBuilt(
      await build(
        { intent: { fields: [{ name: 'b', component: 'Input', label: 'B' }] } },
        ctxOf(first.schema, emptySchema(), first.out.rules)
      )
    );
    expect(collectModelPaths(again.schema)).toEqual(['b']);
  });

  it('без parent на непустой форме — отказ', async () => {
    const filled = expectBuilt(
      await build({ intent: { fields: [{ name: 'a', component: 'Input', label: 'A' }] } })
    ).schema;
    const out = await build(
      { intent: { fields: [{ name: 'b', component: 'Input' }] } },
      ctxOf(filled)
    );
    expect(out.error?.code).toBe('INVALID_PARAMS');
    expect(out.text).toContain('pass parent');
    // Оба выхода: о новой форме — create_form, а не родитель в старой (ReFormer-9a9c).
    expect(out.text).toContain('call create_form');
  });

  it('поля образца грамматики названы в ответе; форма о другом — без замечания', async () => {
    const copied = expectBuilt(await build({ intent: DOCUMENT_GRAMMAR_EXAMPLE }));
    expect(copied.out.text).toMatch(/Fields loanType, price, quantity.* match the grammar example/);

    const vet = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'petName', component: 'Input', label: 'Кличка' },
            { name: 'reason', component: 'Input', label: 'Причина' },
            { name: 'email', component: 'Input', label: 'Почта' },
          ],
        },
      })
    );
    // Одно совпадение имени — не копия образца.
    expect(vet.out.text).not.toContain('grammar example');
  });

  it('поле, которое уже есть в форме, не добавляется второй раз', async () => {
    const filled = expectBuilt(
      await build({ intent: { fields: [{ name: 'a', component: 'Input', label: 'A' }] } })
    ).schema;
    const out = await build(
      { parent: '/root', intent: { fields: [{ name: 'a', component: 'Input' }] } },
      ctxOf(filled)
    );
    expect(out.text).toContain('already-in-form at a: already in the form');
    expect(out.schema).toBeUndefined();
  });

  it('в визард ставятся шаги, а не второй визард', async () => {
    const wizard = expectBuilt(
      await build({
        intent: {
          fields: [{ name: 'a', component: 'Input' }],
          steps: [{ title: 'One', fields: ['a'] }],
        },
      })
    ).schema;
    const { schema } = expectBuilt(
      await build(
        {
          parent: '/root/children/0',
          intent: {
            fields: [{ name: 'city', component: 'Input', label: 'City' }],
            steps: [{ title: 'Delivery', fields: ['city'] }],
          },
        },
        ctxOf(wizard, emptySchema())
      )
    );
    expect(stepsOf(schema)).toHaveLength(2);
    expect(buildOutline(schema).filter((e) => e.component === kit?.wizard)).toHaveLength(1);
  });

  it('поле вне шагов — отказ, ничего не применено', async () => {
    const out = await build({
      intent: {
        fields: [
          { name: 'a', component: 'Input' },
          { name: 'b', component: 'Input' },
        ],
        steps: [{ title: 'One', fields: ['a'] }],
      },
    });
    expect(out.text).toContain('unplaced at layoutRoot: not placed in layoutRoot: b');
    expect(out.schema).toBeUndefined();
  });

  it('выдуманный компонент — отказ судьи до вставки, ничего не применено', async () => {
    const out = await build({ intent: { fields: [{ name: 'a', component: 'EmailField' }] } });
    expect(out.ok).toBe(false);
    expect(out.text).toContain('nothing changed');
    expect(out.text).toContain('the component `EmailField` is not in @reformer/ui-kit');
    expect(out.schema).toBeUndefined();
  });

  it('правило на поле, которого нет, — форма собрана, правило отложено и названо', async () => {
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          fields: [{ name: 'a', component: 'Input' }],
          validation: [{ target: 'missing', rules: ['required'] }],
        },
      })
    );
    expect(collectModelPaths(schema)).toEqual(['a']);
    expect(out.rules?.validation).toEqual([]);
    expect(out.text).toContain('Not applied — rules name fields the form does not have:');
    expect(out.text).toContain('validation "missing": not declared');
  });

  it('два писателя одного поля — отказ правил', async () => {
    const out = await build({
      intent: {
        fields: [
          { name: 'a', component: 'InputNumber' },
          { name: 'b', component: 'InputNumber' },
        ],
        behavior: [
          { kind: 'compute', target: 'a', sources: ['b'], expr: 'model.b' },
          { kind: 'compute', target: 'a', sources: ['b'], expr: 'model.b + 1' },
        ],
      },
    });
    expect(out.text).toContain('two-writers at a: Two behaviours write the same field');
    expect(out.schema).toBeUndefined();
  });

  it('разбирает intent строкой и называет то, что не взято', async () => {
    const { out } = expectBuilt(
      await build({
        intent: JSON.stringify({
          fields: [{ name: 'qty', component: 'InputNumber', label: 'Qty', initialValue: 1 }],
        }),
      })
    );
    expect(out.text).toContain('Not kept: initial values of qty');
  });

  it('подформы не поддержаны — отказ с подсказкой', async () => {
    const out = await build({
      intent: {
        fields: [{ name: 'reg.city', component: 'Input' }],
        parts: { address: { kind: 'container', component: 'Box', children: ['city'] } },
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [{ kind: 'part', ref: 'reg', part: 'address' }],
        },
      },
    });
    expect(out.text).toContain('extract_part');
    expect(out.schema).toBeUndefined();
  });

  it('большой шаг уходит несколькими вызовами insert_node', async () => {
    const fields = Array.from({ length: 60 }, (_, i) => ({
      name: `f${i}`,
      component: 'Input',
      label: `F${i}`,
    }));
    const { schema } = expectBuilt(
      await build({
        intent: { fields, steps: [{ title: 'All', fields: fields.map((f) => f.name) }] },
      })
    );
    expect(collectModelPaths(schema)).toHaveLength(60);
    // Порядок полей сохранён и после разбиения на пакеты.
    expect(collectModelPaths(schema).slice(0, 3)).toEqual(['f0', 'f1', 'f2']);
  });

  it('узлы строит та же фабрика, что у insert_node', async () => {
    const viaBuild = expectBuilt(
      await build({ intent: { fields: [{ name: 'a', component: 'Input', label: 'A' }] } })
    ).schema;
    const viaInsert = insertNodeTool.run(
      {
        parent: '/root',
        nodes: [{ component: 'Input', model: 'a', props: { label: 'A' } }],
      },
      ctxOf(emptySchema())
    );
    expect(viaBuild).toEqual((viaInsert as ToolOutcome).schema);
  });

  it('ответ называет адрес собранной секции и молчит о типах полей', async () => {
    const out = await build({
      intent: {
        fields: [{ name: 'passport.series', component: 'Input', label: 'Серия' }],
        layoutRoot: {
          kind: 'container',
          component: 'Section',
          componentProps: { title: 'Паспорт' },
          children: ['passport.series'],
        },
      },
    });
    expectBuilt(out);
    expect(out.text).toContain('Placed: Section "Паспорт" /root/children/0.');
    expect(out.text).not.toContain('тип не указан');
  });

  it('предупреждение MCP о плоской разметке шагов в ответ не попадает: шаги разложены', async () => {
    const out = await build({
      intent: {
        fields: [{ name: 'a', component: 'Input', label: 'A' }],
        steps: [{ title: 'One', fields: ['a'] }],
      },
    });
    expectBuilt(out);
    expect(out.text).not.toContain('Шагов в intent');
  });

  it('замечания чтения — по-английски, по коду MCP, без замечаний о печати модуля', async () => {
    const out = await build({
      intent: {
        fields: [
          { name: 'a', label: 'A', required: true },
          { name: 'b', component: 'Input', label: 'B', type: 'money2' },
        ],
        layoutRoot: { kind: 'container', component: 'Box', children: ['a', 'b'] },
      },
    });
    expectBuilt(out);
    expect(out.text).toContain('fields[1]: type `money2` is unknown');
    // Подстановка компонента, перенос required и тип по умолчанию — про модуль, не про документ.
    expect(out.text).not.toMatch(/[а-яё]{4}/i);
  });
});

// Записи локальной модели из замера 2026-11-03 (qwen3.8:27b): поле описано там, где оно стоит.
describe('build_form: поля, описанные на месте', () => {
  it('грамматика — профиль document MCP и строки о том, куда ляжет собранное', () => {
    // Контракт intent, под который написаны обёртка грамматики и перенос в документ.
    expect(INTENT_CONTRACT_VERSION).toBe(1);
    const grammar = buildFormGrammar(catalog);
    expect(grammar.startsWith(intentGrammar(catalogsOf(catalog), { profile: 'document' }))).toBe(
      true
    );
    // Профиль держит потолок MCP; строки билдера — сверху, не больше нескольких сотен символов.
    expect(grammar.length).toBeLessThanOrEqual(DOCUMENT_GRAMMAR_LIMIT + 400);
  });

  it('грамматика называет компоненты кита по назначению — и для страницы [ReFormer-11oe.15]', () => {
    const grammar = buildFormGrammar(catalog);
    const section = grammar.slice(
      grammar.indexOf('\n## components'),
      grammar.indexOf('\n## Where')
    );
    expect(section).toMatch(/^layout: .*\bCard\b.*\bTabs\b/m);
    expect(section).toMatch(/^typography: .*\bTypographyH1\b/m);
    expect(section).toMatch(/^inputs: .*\bInput\b/m);
    // У ассистента form_build нет: описание компонента он берёт не оттуда.
    expect(section).not.toContain('form_build');
  });

  it('описание поля в шаге сокращённой записи поднимается в fields', async () => {
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          steps: [
            {
              title: 'One',
              fields: [
                { name: 'a', component: 'Input', label: 'A' },
                { name: 'b', component: 'Input', label: 'B', required: true },
              ],
            },
          ],
        },
      })
    );
    expect(stepsOf(schema)).toHaveLength(1);
    expect(collectModelPaths(schema)).toEqual(['a', 'b']);
    expect(out.rules?.validation.map((r) => r.target)).toEqual(['b']);
  });

  it('узел поля с компонентом в разметке — объявление, а не ссылка на необъявленное', async () => {
    const { schema } = expectBuilt(
      await build({
        intent: {
          layoutRoot: {
            kind: 'container',
            component: 'Box',
            children: [
              { kind: 'field', name: 'city', component: 'Input', label: 'Город' },
              { name: 'street', component: 'Input', label: 'Улица' },
            ],
          },
        },
      })
    );
    expect(collectModelPaths(schema)).toEqual(['city', 'street']);
  });

  it('описание на месте против объявления — отказ key-conflict, а не молчаливый выбор', async () => {
    const out = await build({
      intent: {
        fields: [{ name: 'a', component: 'Input', label: 'Объявлено' }],
        steps: [{ title: 'One', fields: [{ name: 'a', component: 'Input', label: 'На месте' }] }],
      },
    });
    expect(out.ok).toBe(false);
    expect(out.text).toContain('key-conflict at steps[0].fields[0].label');
    expect(out.schema).toBeUndefined();
  });

  it('раскладка списком — дети корня; intent-шаг — шаг', async () => {
    const list = expectBuilt(
      await build({ intent: { layoutRoot: [{ name: 'a', component: 'Input', label: 'A' }] } })
    );
    expect(collectModelPaths(list.schema)).toEqual(['a']);
    const step = expectBuilt(
      await build({
        intent: {
          kind: 'step',
          title: 'Доставка',
          children: [{ kind: 'field', name: 'city', component: 'Input', label: 'Город' }],
          validation: [{ target: 'city', rules: ['required'] }],
        },
      })
    );
    expect(stepsOf(step.schema)).toHaveLength(1);
    expect(step.out.rules?.validation.map((r) => r.target)).toEqual(['city']);
  });

  it('один шаг ключом step или объектом вместо списка steps — шаг', async () => {
    for (const intent of [
      {
        step: { title: 'Доставка', fields: [{ name: 'city', component: 'Input', label: 'Город' }] },
      },
      {
        steps: {
          title: 'Доставка',
          fields: [{ name: 'city', component: 'Input', label: 'Город' }],
        },
      },
    ]) {
      const { schema } = expectBuilt(await build({ intent }));
      expect(stepsOf(schema)).toHaveLength(1);
      expect(collectModelPaths(schema)).toEqual(['city']);
    }
  });

  it('поле шага по пути модели и тип-компонент — запись B.2 из замера', async () => {
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          step: {
            title: 'Доставка',
            fields: [
              { label: 'Город', model: 'delivery.city', required: true, type: 'text' },
              { label: 'Комментарий курьеру', model: 'delivery.comment', type: 'textarea' },
            ],
          },
        },
      })
    );
    expect(collectModelPaths(schema)).toEqual(['delivery.city', 'delivery.comment']);
    expect(JSON.stringify(schema)).toContain('$component(Textarea)');
    expect(out.rules?.validation.map((r) => r.target)).toEqual(['delivery.city']);
  });

  it('массив, объявленный полем, — массив со строками, а не поле без строк', async () => {
    const rows = [
      { name: 'type', component: 'Input', label: 'Тип' },
      { name: 'value', component: 'InputNumber', label: 'Стоимость' },
    ];
    for (const intent of [
      {
        fields: [{ name: 'properties', type: 'array', label: 'Имущество', itemFields: rows }],
        steps: [{ title: 'A', fields: ['properties'] }],
      },
      {
        steps: [
          {
            title: 'A',
            fields: [{ name: 'properties', type: 'array', label: 'Имущество', fields: rows }],
          },
        ],
      },
    ]) {
      const { schema } = expectBuilt(await build({ intent }));
      const text = JSON.stringify(schema);
      expect(text).toContain('$model(properties)');
      expect(text).toContain('$model(type)');
      expect(text).toContain('$model(value)');
    }
  });

  it('запись поля в шаге без имени — отказ, а не пустой шаг', async () => {
    const out = await build({
      intent: { steps: [{ title: 'A', fields: [{ label: 'Город', component: 'Input' }] }] },
    });
    expect(out.ok).toBe(false);
    expect(out.text).toContain('missing-key at steps[0].fields[0]: a step field has no name');
  });

  it('голое имя в разметке — ссылка на поле, а не пустой контейнер (запись B.3)', async () => {
    const { schema } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'city', component: 'Input', label: 'Город' },
            { name: 'same', component: 'Checkbox', label: 'Совпадает' },
          ],
          layoutRoot: [
            { kind: 'container', component: 'Box', children: ['city'] },
            { name: 'same' },
          ],
        },
      })
    );
    expect(collectModelPaths(schema)).toEqual(['city', 'same']);
  });

  it('неразмещённое поле без шагов — отказ про разметку, а не про шаги', async () => {
    const out = await build({
      intent: {
        fields: [
          { name: 'a', component: 'Input', label: 'A' },
          { name: 'b', component: 'Input', label: 'B' },
        ],
        layoutRoot: { kind: 'container', component: 'Box', children: ['a'] },
      },
    });
    expect(out.ok).toBe(false);
    expect(out.text).toContain('not placed in layoutRoot: b');
    expect(out.text).toContain('put each name into a node of `layoutRoot`');
  });

  it('правило среди полей переносится в validation — запись 21.4 из замера', async () => {
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'phone', component: 'Input', label: 'Телефон' },
            { target: 'phone', rules: ['required'] },
          ],
        },
      })
    );
    expect(collectModelPaths(schema)).toEqual(['phone']);
    expect(out.rules?.validation.map((r) => r.target)).toEqual(['phone']);
  });

  it('intent JSON-строкой проходит проверку аргументов реестра (запись 21.4)', async () => {
    const registry = createEditorToolRegistry();
    const out = await registry.invoke(
      'build_form',
      { intent: JSON.stringify({ fields: [{ name: 'a', component: 'Input', label: 'A' }] }) },
      ctxOf(emptySchema())
    );
    expect(out.error?.code, out.text).toBeUndefined();
    expect(collectModelPaths(out.schema as JsonFormSchema)).toEqual(['a']);
  });

  it('правило без валидаторов отбрасывается, а не валит весь intent', async () => {
    const { out } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'phone', component: 'Input', label: 'Телефон' },
            { name: 'phone2', component: 'Input', label: 'Ещё телефон' },
          ],
          validation: [
            { target: 'phone', rules: ['required'] },
            { target: 'phone2', rules: [] },
          ],
        },
      })
    );
    expect(out.rules?.validation.map((r) => r.target)).toEqual(['phone']);
  });

  it('пустой intent — отказ с полученными ключами и ожидаемой записью', async () => {
    // Незнакомый ключ называет само чтение MCP (`unknown-key`), с перечнем ключей intent.
    const out = await build({ intent: { blocks: [{ title: 'A' }] } });
    expect(out.ok).toBe(false);
    expect(out.text).toContain('unknown key `blocks`');
    expect(out.text).toContain('fields');
    expect(out.text).toContain('build_form without intent');
  });
});

describe('build_form по умолчанию', () => {
  it('промпт укладывается в потолок, называет build_form и сборку визарда по шагам', () => {
    const text = systemPrompt(catalog);
    expect(text.length).toBeLessThanOrEqual(PROMPT_BUDGET);
    expect(text).toContain('ONE build_form call');
    expect(text).toContain('build_form with only the steps first, then one build_form per step');
    expect(systemPrompt(catalog, { buildForm: false })).not.toContain('build_form');
  });

  it('затравка пустой формы несёт грамматику и порядок сборки визарда', () => {
    const seed = formSeed(emptySchema(), undefined, [], buildFormEmptySeed('GRAMMAR'));
    expect(seed).toContain('build it with build_form, no parent');
    expect(seed).toContain('first only the steps, then one call per step');
    expect(seed).toContain('GRAMMAR');
  });

  it('build_form стоит в наборе перед insert_node; buildForm: false — набор без него', () => {
    const names = (options: { buildForm?: boolean }) =>
      structuredSlots(options).map((slot) => (typeof slot === 'string' ? slot : slot.name));
    const flagged = names({});
    expect(flagged.indexOf('build_form')).toBe(flagged.indexOf('insert_node') - 1);
    expect(names({ buildForm: false })).not.toContain('build_form');
  });

  it('грамматика называет сборку по шагам, а её пример шагов собирается', () => {
    const grammar = buildFormGrammar(catalog);
    expect(grammar).toContain(
      `first ${JSON.stringify(BUILD_FORM_STEPS_EXAMPLE)}, then one build_form`
    );
    expect(grammar).not.toContain('Big form');
  });
});

describe('build_form: пути правил против полей формы (ReFormer-t4fr)', () => {
  const num = (name: string, label: string) => ({ name, component: 'InputNumber', label });
  const total = {
    kind: 'compute',
    target: 'total_guests',
    sources: ['adults', 'children'],
    expr: '(model.adults ?? 0) + (model.children ?? 0)',
  };

  it('ход из чата: форма собрана, связи без полей отложены с починкой', async () => {
    // Живой ход: compute в необъявленный total_guests и enableWhen с источником из образца
    // грамматики (тогда — kind, в образце MCP — loanType). Отказ целиком повторялся четыре раза —
    // человек оставался без формы.
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'name', component: 'Input', label: 'Name', required: true },
            { name: 'with_guests', component: 'Checkbox', label: 'With guests' },
          ],
          arrays: [
            {
              name: 'guests',
              itemFields: [{ name: 'guest_name', component: 'Input', label: 'Guest' }],
            },
          ],
          behavior: [
            {
              kind: 'compute',
              target: 'total_guests',
              sources: ['guests'],
              expr: '(model.guests?.length ?? 0) + 1',
            },
            {
              kind: 'enableWhen',
              target: 'guests',
              sources: ['loanType'],
              expr: 'model.with_guests === true',
            },
          ],
        },
      })
    );
    expect(collectModelPaths(schema)).toEqual(['name', 'with_guests', 'guests']);
    expect(out.rules?.behavior).toEqual([]);
    expect(out.rules?.validation.map((r) => r.target)).toEqual(['name']);
    // Цель вычисления: «объяви поле», а не «did you mean guests?» — с ней модель не объявляла.
    expect(out.text).toContain(
      'compute target "total_guests": not declared. A computed field is a field too'
    );
    expect(out.text).not.toContain('did you mean guests');
    expect(out.text).toContain(
      'enableWhen source "loanType": a name from the grammar example, not from this form'
    );
    expect(out.text).toContain('The rest is built.');
  });

  it('несколько путей без поля — все в одном ответе, годные правила ложатся', async () => {
    const { out } = expectBuilt(
      await build({
        intent: {
          fields: [num('adults', 'Adults'), num('children', 'Children')],
          validation: [
            { target: 'phone', rules: ['required'] },
            { target: 'adults', rules: ['required'] },
          ],
          behavior: [total],
        },
      })
    );
    expect(out.rules?.validation.map((r) => r.target)).toEqual(['adults']);
    expect(out.text).toContain('validation "phone": not declared');
    expect(out.text).toContain('compute target "total_guests"');
  });

  it('короткое имя единственного поля группы — полный путь, и ответ об этом говорит', async () => {
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          fields: [
            num('guests.adults', 'Adults'),
            num('guests.children', 'Children'),
            num('guests.total_guests', 'Total'),
          ],
          behavior: [{ ...total, sources: ['guests.adults', 'guests.children'] }],
          validation: [{ target: 'adults', rules: ['required'] }],
        },
      })
    );
    expect(collectModelPaths(schema)).toContain('guests.total_guests');
    expect(out.rules?.behavior[0].target).toBe('guests.total_guests');
    expect(out.rules?.validation[0].target).toBe('guests.adults');
    expect(out.text).toContain('compute target "total_guests" read as "guests.total_guests"');
    expect(out.text).not.toContain('Not applied');
  });

  it('короткое имя двух полей групп — не угадывается: правило отложено с обоими путями', async () => {
    const { out } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'billing.email', component: 'Input', label: 'Billing' },
            { name: 'contact.email', component: 'Input', label: 'Contact' },
          ],
          validation: [{ target: 'email', rules: ['email'] }],
        },
      })
    );
    expect(out.rules?.validation).toEqual([]);
    expect(out.text).toContain('validation "email": no such field; did you mean');
    expect(out.text).toContain('billing.email');
    expect(out.text).toContain('contact.email');
  });

  it('добавление в форму: правило на поле, которое уже было в форме, принимается', async () => {
    const first = expectBuilt(
      await build({ intent: { fields: [num('adults', 'Adults'), num('children', 'Children')] } })
    );
    const base = emptySchema();
    const out = await build(
      { parent: '/root', intent: { fields: [num('total_guests', 'Total')], behavior: [total] } },
      ctxOf(first.schema, base, first.out.rules)
    );
    expect(out.error?.code, out.text).toBeUndefined();
    expect(out.rules?.behavior.map((b) => b.target)).toContain('total_guests');
  });
});

describe('build_form: перенос в документ и записи, которым в нём нет места (аудит 2026-11, D4)', () => {
  const fields = [
    { name: 'loanType', component: 'Select', label: 'Type', optionsSource: 'TYPES' },
    { name: 'price', component: 'InputNumber', label: 'Price' },
    { name: 'fee', component: 'InputNumber', label: 'Fee' },
  ];
  const dataSources = [{ name: 'TYPES', values: [{ value: 'm', label: 'Mortgage' }] }];

  /** Строки связей и правил узлов, как их печатает генерация, — файлом поведения. */
  function printedBehavior(schema: JsonFormSchema, rules: ToolOutcome['rules']): string {
    const view = behaviorView(prepare({ schema, formName: 'Probe', kit: builtinKit(), rules }));
    const nodes = view.groups.flatMap((group) => group.rules.flatMap((rule) => rule.lines));
    return [
      'export function behaviorRules({ model, schema }: BehaviorScope<Form>): void {',
      ...[...view.links, ...nodes].map((line) => `  ${line}`),
      '}',
      '',
    ].join('\n');
  }

  it('when вычисления и событие узла доходят до правил, печатаются и читаются обратно', async () => {
    const { schema, out } = expectBuilt(
      await build({
        intent: {
          fields,
          steps: [{ title: 'One', fields: ['loanType', 'price', 'fee'] }],
          dataSources,
          behavior: [
            {
              kind: 'compute',
              target: 'fee',
              sources: ['price'],
              expr: '(model.price ?? 0) * 0.01',
              when: "model.loanType === 'm'",
            },
            {
              kind: 'onComponentEvent',
              selector: 'wizard',
              event: 'onSubmit',
              expr: 'await Promise.resolve(args);',
            },
          ],
        },
      })
    );
    expect(out.rules?.behavior).toEqual([
      expect.objectContaining({ kind: 'compute', target: 'fee', when: "model.loanType === 'm'" }),
    ]);
    // `await` в теле — обработчик асинхронный, как у MCP (ReFormer-o8rm).
    expect(out.rules?.render).toEqual([
      expect.objectContaining({ kind: 'onEvent', event: 'onSubmit', async: true }),
    ]);

    const read = readRulesFromCode({
      validation: [],
      behavior: { path: 'behavior/index.ts', text: printedBehavior(schema, out.rules) },
      constants: [],
    });
    expect(read.files[0]?.foreign).toEqual([]);
    expect(read.rules.behavior).toEqual([
      expect.objectContaining({ kind: 'compute', target: 'fee', when: "model.loanType === 'm'" }),
    ]);
    expect(read.rules.render).toEqual([
      expect.objectContaining({ kind: 'onEvent', event: 'onSubmit', async: true }),
    ]);
  });

  it('код модуля, severity и неизвестный селектор — один отказ со всеми пунктами', async () => {
    const out = await build({
      intent: {
        fields,
        dataSources,
        validation: [
          {
            target: 'price',
            cross: 'values.price > 0',
            code: 'price.negative',
            message: 'The price is positive',
            severity: 'warning',
          },
          { target: 'fee', call: 'feeRule(model.$.fee)', code: 'fee', message: 'Wrong fee' },
        ],
        behavior: [
          { kind: 'call', target: 'price', expr: 'roundTo(model.$.price, 100)' },
          { kind: 'onMount', selector: 'fee', expr: 'console.log(model.get())' },
        ],
        visibility: [{ selector: 'nowhere', condition: 'model.price === null' }],
        operators: { feeRule: './operators', roundTo: './operators' },
      },
    });
    expect(out.ok).toBe(false);
    expect(out.schema).toBeUndefined();
    expect(out.text).toMatch(/^The intent was not built, nothing changed — 6 problems:/);
    for (const item of [
      '- not-in-document at operators:',
      '- not-in-document at validation[0].severity:',
      '- not-in-document at validation[1].call:',
      '- not-in-document at behavior: call price:',
      '- not-in-document at behavior: onMount fee:',
      '- C6: A visibility rule targets `nowhere`',
    ]) {
      expect(out.text).toContain(item);
    }
  });

  it('справочник без значений и начальное значение — «Not kept», форма собрана', async () => {
    const { out } = expectBuilt(
      await build({
        intent: {
          fields: [
            { name: 'kind', component: 'Select', label: 'Kind', optionsSource: 'KINDS' },
            { name: 'qty', component: 'InputNumber', label: 'Quantity', initialValue: 1 },
          ],
          dataSources: [{ name: 'KINDS' }],
        },
      })
    );
    expect(out.text).toContain('Not kept: initial values of qty');
    expect(out.text).toContain('the data source `KINDS` has no values');
    expect(out.rules?.dataSources).toBeUndefined();
  });

  it('ответ не обрезается по бюджету точечных инструментов', async () => {
    const many = Array.from({ length: 70 }, (_, i) => ({
      name: `veryLongFieldNameNumber${i}`,
      component: 'Input',
      label: `Field ${i}`,
      initialValue: `value ${i}`,
    }));
    const { out } = expectBuilt(await build({ intent: { fields: many } }));
    // Прежний ответ резался по 1500 символов при бюджете инструмента 4000 (аудит 2026-11, D5).
    expect(out.text.length).toBeGreaterThan(1500);
    expect(out.text).toContain('before you finish');
  });
});
