import { validateFormSchema } from '@reformer/renderer-json/validate';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { describe, expect, it } from 'vitest';
import { builtinEntries } from '../../../core/testing';
import { collectModelPaths, emptyRules, emptySchema, getAt } from '../../../core/form-model';
import { buildOutline } from '../model/outline';
import { wizardNames } from '../model/catalog-digest';
import type { ToolContext, ToolOutcome } from '../model/types';
import { buildFormTool } from './build-form';
import {
  BUILD_FORM_EXAMPLE,
  BUILD_FORM_STEPS_EXAMPLE,
  buildFormGrammar,
} from './build-form/grammar';
import { liftInline } from './build-form/lift';
import { insertNodeTool } from './insert-node';
import { structuredSlots } from '.';
import { systemPrompt } from '../loop/prompt';
import { buildFormEmptySeed, formSeed } from '../stack/seed';
import { PROMPT_BUDGET } from '../model/types';

const catalog = builtinEntries();
const kit = wizardNames(catalog);

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
    expect(out.text).toContain('# build_form intent');
    expect(out.text).toContain('InputNumber');
  });

  it('пример грамматики собирается: поля, строки массива, правила, видимость', async () => {
    const { schema, out } = expectBuilt(await build({ intent: BUILD_FORM_EXAMPLE }));
    const paths = collectModelPaths(schema);
    for (const name of ['email', 'kind', 'inn', 'price', 'qty', 'total', 'billingEmail']) {
      expect(paths).toContain(name);
    }
    expect(JSON.stringify(schema)).toContain('$model(name)');
    expect(out.rules?.validation.map((r) => r.target)).toEqual(
      expect.arrayContaining(['email', 'inn', 'qty', 'billingEmail'])
    );
    expect(out.rules?.behavior.map((b) => b.kind)).toEqual(['compute', 'copyFrom', 'enableWhen']);
    expect(out.rules?.render).toEqual([
      expect.objectContaining({ kind: 'hideWhen', condition: 'model.sameEmail === true' }),
    ]);
    expect(out.rules?.dataSources?.KINDS).toHaveLength(2);
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

  it('форма из нескольких шагов с полями сразу — отказ с первым вызовом по шагам', async () => {
    const out = await build({
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
    });
    expect(out.ok).toBe(false);
    expect(out.schema).toBeUndefined();
    expect(out.text).toContain('{"steps":[{"title":"One"},{"title":"Two"}]}');
  });

  it('форма по шагам: шаги, затем поля и правила каждого шага в его адрес', async () => {
    const steps = expectBuilt(await build({ intent: BUILD_FORM_STEPS_EXAMPLE }));
    const [client, order] = stepsOf(steps.schema).map((entry) => entry.ref);
    const { fields, arrays, validation, behavior, visibility, dataSources } = BUILD_FORM_EXAMPLE;
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
  });

  it('поле, которое уже есть в форме, не добавляется второй раз', async () => {
    const filled = expectBuilt(
      await build({ intent: { fields: [{ name: 'a', component: 'Input', label: 'A' }] } })
    ).schema;
    const out = await build(
      { parent: '/root', intent: { fields: [{ name: 'a', component: 'Input' }] } },
      ctxOf(filled)
    );
    expect(out.text).toContain('Already in the form: a');
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
    expect(out.text).toContain('Not placed in any step: b');
    expect(out.schema).toBeUndefined();
  });

  it('выдуманный компонент — отказ insert_node с адресом, ничего не применено', async () => {
    const out = await build({ intent: { fields: [{ name: 'a', component: 'EmailField' }] } });
    expect(out.error?.code).toBe('UNKNOWN_COMPONENT');
    expect(out.text).toContain('Nothing was changed');
    expect(out.schema).toBeUndefined();
  });

  it('правило на поле, которого нет, — отказ правил, ничего не применено', async () => {
    const out = await build({
      intent: {
        fields: [{ name: 'a', component: 'Input' }],
        validation: [{ target: 'missing', rules: ['required'] }],
      },
    });
    expect(out.text).toMatch(/^Rules: /);
    expect(out.schema).toBeUndefined();
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
    expect(out.text).toContain('Two behaviours write the same field');
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
});

// Записи локальной модели из замера 2026-11-03 (qwen3.8:27b): поле описано там, где оно стоит.
describe('build_form: поля, описанные на месте', () => {
  it('intent в записи грамматики не меняется — то же значение', () => {
    const names = catalog.map((entry) => entry.name);
    expect(liftInline(BUILD_FORM_EXAMPLE, names)).toEqual({
      intent: BUILD_FORM_EXAMPLE,
      problems: [],
    });
    expect(liftInline(BUILD_FORM_EXAMPLE, names).intent).toBe(BUILD_FORM_EXAMPLE);
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

  it('объявленное в fields побеждает описание на месте', async () => {
    const { schema } = expectBuilt(
      await build({
        intent: {
          fields: [{ name: 'a', component: 'Input', label: 'Объявлено' }],
          steps: [{ title: 'One', fields: [{ name: 'a', component: 'Input', label: 'На месте' }] }],
        },
      })
    );
    expect(JSON.stringify(schema)).toContain('Объявлено');
    expect(JSON.stringify(schema)).not.toContain('На месте');
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
    expect(out.text).toContain('steps[0].fields[0]: a field without "name"');
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
    expect(out.text).toContain('Not placed in the layout: b.');
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
    const out = await build({ intent: { blocks: [{ title: 'A' }] } });
    expect(out.ok).toBe(false);
    expect(out.text).toContain('top-level keys received: blocks');
    expect(out.text).toContain('"fields": [{ "name", "component", "label" }]');
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
      `1. Only the steps, no fields: ${JSON.stringify(BUILD_FORM_STEPS_EXAMPLE)}`
    );
    expect(grammar).not.toContain('Big form');
  });
});
