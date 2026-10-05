/**
 * Единый контракт формы в выводе генератора.
 *
 * Контракт один на три способа реализации: одна схема-дерево с привязкой `model`, одно поведение
 * `({ model, form, schema })`, одна сборка `createForm`. Здесь зафиксировано, что генератор
 * печатает именно его — для каждого таргета — и что напечатанное принимают настоящие пакеты:
 * ajv-схема `renderer-json` и компилятор TypeScript с типами `@reformer/*`.
 *
 * Отдельный файл, а не блок в `generate-form.test.ts`: тот держит прежние эмиттеры
 * (`buildLayoutJson`, `buildValidationTs`), которыми до переезда печатает конструктор, и их вывод
 * закреплён побайтно. Смешивать два контракта в одном наборе кейсов — значит потерять из виду,
 * какой из них проверяется.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildAssemblyTsx,
  buildBundle,
  buildFormBehaviorTs,
  buildFormValidationTs,
  buildModelTs,
} from '../src/core/generate/builders.js';
import { crossCheckBundle } from '../src/core/generate/cross-check.js';
import { readIntent, type FormIntent } from '../src/core/generate/form-intent.js';
import { buildFormSchemaJson, buildFormSchemaTs } from '../src/core/generate/schema-emit.js';
import { generateFormTool } from '../src/core/tools/generate-form';
import { validateCode } from '../src/core/validate/code';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

const k = cliKnowledge();

type Target = FormIntent['target'];
const TARGETS: Target[] = ['core', 'renderer-react', 'renderer-json'];

/**
 * Форма, в которой есть всё, что различает контракты: визард, подформа в двух местах, массив
 * под-форм, условное правило, правило строки массива, связь над моделью и правило узла схемы.
 */
function loanIntent(target: Target): FormIntent {
  const { intent, problems } = readIntent({
    formName: 'Loan request',
    interfaceName: 'LoanRequest',
    target,
    fields: [
      {
        name: 'loanType',
        type: 'string',
        component: 'Select',
        label: 'Тип',
        optionsSource: 'LOAN_TYPES',
      },
      { name: 'amount', type: 'number', component: 'InputNumber', label: 'Сумма' },
      { name: 'propertyValue', type: 'number', component: 'InputNumber', label: 'Стоимость' },
      { name: 'registration.city', type: 'string', component: 'Input', label: 'Город' },
      { name: 'registration.street', type: 'string', component: 'Input', label: 'Улица' },
      { name: 'residence.city', type: 'string', component: 'Input', label: 'Город' },
      { name: 'residence.street', type: 'string', component: 'Input', label: 'Улица' },
      { name: 'agree', type: 'boolean', component: 'Checkbox', label: 'Согласен' },
    ],
    arrays: [
      {
        name: 'properties',
        itemInterfaceName: 'PropertyItem',
        initialValue: [],
        itemFields: [
          { name: 'type', type: 'string', component: 'Input', initialValue: 'apartment' },
          { name: 'value', type: 'number', component: 'InputNumber' },
        ],
      },
    ],
    parts: {
      address: { kind: 'container', component: 'Box', children: ['city', 'street'] },
    },
    layoutRoot: {
      kind: 'container',
      component: 'Box',
      selector: 'wizard',
      children: [
        {
          kind: 'step',
          title: 'Кредит',
          selector: 'loan',
          children: [
            'loanType',
            'amount',
            {
              kind: 'container',
              component: 'Section',
              selector: 'mortgage',
              children: ['propertyValue'],
            },
          ],
        },
        {
          kind: 'step',
          title: 'Адреса',
          children: [
            { kind: 'part', ref: 'registration', part: 'address' },
            { kind: 'part', ref: 'residence', part: 'address', selector: 'residence' },
            { kind: 'array', ref: 'properties' },
          ],
        },
        { kind: 'step', title: 'Согласие', selector: 'confirm', children: ['agree'] },
      ],
    },
    validation: [
      { target: 'loanType', rules: ['required'] },
      { target: 'amount', rules: ['required', 'min(1000)'] },
      { target: 'propertyValue', rules: ['required'], when: "model.loanType === 'mortgage'" },
      { target: 'registration.city', rules: ['required'] },
      { target: 'type', each: 'properties', rules: ['required'] },
    ],
    behavior: [
      {
        kind: 'enableWhen',
        target: 'propertyValue',
        sources: ['loanType'],
        expr: "model.loanType === 'mortgage'",
      },
    ],
    visibility: [{ selector: 'mortgage', condition: "model.loanType !== 'mortgage'" }],
    dataSources: [{ name: 'LOAN_TYPES' }],
  });
  expect(problems, 'образец обязан читаться целиком').toEqual([]);
  return intent;
}

const fileOf = (target: Target, path: string): string => {
  const file = buildBundle(loanIntent(target)).files.find((f) => f.path === path);
  expect(file, `${path} не напечатан для ${target}`).toBeDefined();
  return file!.content;
};

describe('набор файлов', () => {
  for (const target of TARGETS) {
    it(`${target}: схема, поведение и валидация — по одному файлу`, () => {
      const paths = buildBundle(loanIntent(target)).files.map((f) => f.path);
      expect(paths).toEqual(
        expect.arrayContaining([
          'model.ts',
          'form.schema.ts',
          'form.validation.ts',
          'form.behavior.ts',
        ])
      );
      // Файлов прежнего контракта нет ни у одного таргета.
      for (const gone of ['form.render.ts', 'wizard.tsx', 'layout.json', 'form.schema.json']) {
        expect(paths, `${gone} — файл прежнего контракта`).not.toContain(gone);
      }
      expect(paths.includes('registry.ts')).toBe(target === 'renderer-json');
    });
  }
});

describe('model.ts', () => {
  it('шаблон нового элемента массива объявлен в модели через arrayOf', () => {
    const ts = buildModelTs(loanIntent('renderer-react'));
    expect(ts).toContain("import { arrayOf, createModel } from '@reformer/core';");
    expect(ts).toContain('const blankPropertyItem = (): PropertyItem => ({');
    // Начальное значение поля элемента взято из intent, остальное — пустое по типу.
    expect(ts).toMatch(/type: "apartment",/);
    expect(ts).toContain('properties: arrayOf(blankPropertyItem),');
    expect(ts).toContain('export const createFormModel = () =>');
    expect(ts).toContain('createModel<LoanRequest>({');
  });

  it('форма без массивов не тянет arrayOf', () => {
    const { intent } = readIntent({
      formName: 'Simple',
      fields: [{ name: 'email', type: 'string', component: 'Input' }],
    });
    const ts = buildModelTs(intent);
    expect(ts).toContain("import { createModel } from '@reformer/core';");
    expect(ts).not.toContain('arrayOf');
  });
});

describe('form.schema.ts — TS-таргеты', () => {
  const ts = buildFormSchemaTs(loanIntent('renderer-react')).content;

  it('узел привязан ключом `model` и ручкой `model.$.…`', () => {
    expect(ts).toContain('model: model.$.loanType,');
    expect(ts, 'ключи прежнего контракта не печатаются').not.toMatch(/\bvalue: model\.\$/);
    expect(ts).not.toMatch(/\barray: model\./);
  });

  it('визард — библиотечный компонент, шаги — его дети с селектором', () => {
    expect(ts).toContain("import { Step } from '@reformer/cdk/form-wizard';");
    expect(ts).toMatch(/selector: 'wizard',\s+component: FormWizard,\s+children: \[/);
    expect(ts).toMatch(
      /selector: 'loan',\s+component: Step,\s+componentProps: \{ title: 'Кредит' \}/
    );
    // Шаг без селектора получает ключ по номеру — тот же, что в `validation.steps`.
    expect(ts).toContain("selector: 'step2',");
    expect(ts, 'шаги не лежат в componentProps').not.toContain('steps:');
  });

  it('подформа объявлена один раз и подключена дважды узлом `part`', () => {
    expect(ts.match(/^const address = /gm)).toHaveLength(1);
    expect(ts).toContain('{ model: model.$.registration, part: address },');
    expect(ts).toContain("{ selector: 'residence', model: model.$.residence, part: address },");
    // Пути внутри части — от под-модели, без префикса группы.
    expect(ts).toContain('model: model.$.city,');
    expect(ts).not.toContain('model.$.registration.city');
  });

  it('массив под-форм: `item` — часть строки, шаблон элемента в схему не дублируется', () => {
    expect(ts).toMatch(
      /model: model\.\$\.properties,\s+component: FormArray,\s+item: propertiesRow,/
    );
    expect(ts).toContain('const propertiesRow = (model: FormModel<PropertyItem>): FormSchemaNode');
    expect(ts).not.toContain('initialValue');
  });

  it('core получает ту же схему, что renderer-react', () => {
    expect(buildFormSchemaTs(loanIntent('core')).content).toBe(ts);
  });
});

describe('form.schema.ts — документ формата 2', () => {
  const document = JSON.parse(buildFormSchemaJson(loanIntent('renderer-json')));

  it('несёт `format: 2`, словарь частей и шаги в `children`', () => {
    expect(document.format).toBe(2);
    expect(Object.keys(document.parts)).toEqual(
      expect.arrayContaining(['address', 'propertiesRow'])
    );
    expect(document.root.component).toBe('$component(FormWizard)');
    expect(document.root.componentProps?.steps, 'шаги — дети визарда').toBeUndefined();
    expect(document.root.children.map((s: { selector: string }) => s.selector)).toEqual([
      'loan',
      'step2',
      'confirm',
    ]);
  });

  it('подформа и массив ссылаются на части оператором `$part`', () => {
    const step = document.root.children[1].children;
    expect(step[0]).toEqual({ model: '$model(registration)', part: '$part(address)' });
    expect(step[1]).toEqual({
      selector: 'residence',
      model: '$model(residence)',
      part: '$part(address)',
    });
    expect(step[2]).toMatchObject({
      model: '$model(properties)',
      component: '$component(FormArray)',
      item: '$part(propertiesRow)',
    });
    expect(step[2].initialValue, 'шаблон элемента — в модели').toBeUndefined();
    // Пути внутри части относительны.
    expect(JSON.stringify(document.parts.address)).toContain('"$model(city)"');
  });

  it('принимается настоящим валидатором renderer-json', async () => {
    const { validateFormSchema } = await import('@reformer/renderer-json/validate');
    const result = validateFormSchema(document);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('файл бандла — тот же документ в `defineJsonSchema<T>`', () => {
    const ts = fileOf('renderer-json', 'form.schema.ts');
    expect(ts).toContain('export const formSchema = defineJsonSchema<LoanRequest>({');
    expect(ts).toContain('"format": 2,');
  });
});

describe('form.validation.ts', () => {
  const ts = buildFormValidationTs(loanIntent('renderer-react'));

  it('массив валидируется через applyEach с под-схемой строки', () => {
    expect(ts).toContain('const propertiesRowRules = defineValidationSchema<PropertyItem>');
    expect(ts).toContain('applyEach(model.$.properties, propertiesRowRules);');
    expect(ts, '`each` — прежнее имя оператора').not.toMatch(/\beach\(/);
  });

  it('ключ шага — селектор шага из схемы; шаг без правил объявлен явно', () => {
    expect(ts).toContain('export const formValidation: FormValidation<LoanRequest> = {');
    expect(ts).toMatch(/steps: \{\s+loan: loanRules,\s+step2: step2Rules,\s+confirm: null,\s+\}/);
    expect(ts).not.toContain('makeValidationConfig');
  });

  it('условное правило остаётся в своём шаге', () => {
    expect(ts).toMatch(
      /validateWhen\(\(\) => model\.loanType === 'mortgage', \(\) => \{\s+validate\(model\.\$\.propertyValue/
    );
  });

  it('одинакова для всех таргетов', () => {
    for (const target of TARGETS) expect(buildFormValidationTs(loanIntent(target))).toBe(ts);
  });
});

describe('form.behavior.ts — единственное поведение', () => {
  it('правило узла стоит рядом со связью над моделью', () => {
    const { content, warnings } = buildFormBehaviorTs(loanIntent('renderer-react'));
    expect(content).toContain(
      'export const formBehavior = defineFormBehavior<LoanRequest>(({ model, schema }) => {'
    );
    expect(content).toContain(
      "enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage');"
    );
    expect(content).toContain(
      "hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');"
    );
    expect(content).toContain("from '@reformer/core/behaviors';");
    expect(warnings).toEqual([]);
  });

  it('в core правила узлов не печатаются — и об этом сказано', () => {
    // Операторы узлов только записывают правило, исполняет его рендерер. В `core` разметку
    // рисует JSX, и напечатанный `hideWhen` был бы мёртвым кодом, который выглядит рабочим.
    const { content, warnings } = buildFormBehaviorTs(loanIntent('core'));
    expect(content).not.toContain('hideWhen');
    expect(content).toContain('enableWhen(model.$.propertyValue');
    expect(warnings.join(' ')).toMatch(/правила узлов схемы исполняет рендерер/);
  });
});

describe('сборка — index.tsx', () => {
  it('одна фабрика и один хук на все таргеты', () => {
    for (const target of TARGETS) {
      const tsx = buildAssemblyTsx(loanIntent(target));
      expect(tsx).toContain("import { createForm, useFormBundle } from '@reformer/core';");
      expect(tsx).toContain('createForm<LoanRequest>({');
      expect(tsx).toContain('model: createFormModel(),');
      expect(tsx).toContain('behavior: formBehavior,');
      for (const legacy of [
        'createCoreForm',
        'createReactForm',
        'createJsonForm',
        'JsonFormRenderer',
      ]) {
        expect(tsx, `${legacy} — прежний контракт`).not.toContain(legacy);
      }
    }
  });

  it('таргеты различаются только видом схемы и тем, кто рисует', () => {
    const react = buildAssemblyTsx(loanIntent('renderer-react'));
    expect(react).toContain(
      '<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />'
    );
    expect(react).not.toContain('registry');

    const json = buildAssemblyTsx(loanIntent('renderer-json'));
    expect(json).toContain('const registry = createRegistry();');
    expect(json).toMatch(/schema: formSchema,\s+registry,/);
    expect(json).toContain('<FormRenderer form={bundle} />');

    const core = buildAssemblyTsx(loanIntent('core'));
    expect(core, 'разметку в core рисует JSX').not.toContain('FormRenderer');
  });

  it('манифест печатает образец сборки', async () => {
    const { content } = await generateFormTool({ intent: loanIntent('renderer-json') });
    const text = content[0].text;
    expect(text).toContain('## Сборка — `index.tsx` (пишете сами)');
    expect(text).toContain('createForm<LoanRequest>({');
    expect(text).toMatch(/✅ Кросс-проверка пройдена/);
  });
});

describe('кросс-проверка бандла формата 2', () => {
  const run = (intent: FormIntent, mutate?: (document: Record<string, unknown>) => void) => {
    const document = JSON.parse(buildFormSchemaJson(intent));
    mutate?.(document);
    return crossCheckBundle(intent, document);
  };

  for (const target of TARGETS) {
    it(`${target}: согласованный бандл проходит`, () => {
      const report = run(loanIntent(target));
      expect(report.errors, report.errors.map((e) => e.message).join('; ')).toEqual([]);
    });
  }

  it('C8 — ссылка на необъявленную часть', () => {
    const report = run(loanIntent('renderer-json'), (document) => {
      delete (document.parts as Record<string, unknown>).address;
    });
    const c8 = report.errors.filter((e) => e.code === 'C8');
    expect(c8.map((e) => e.message).join(' ')).toMatch(/\$part\(address\)/);
  });

  it('C8 — у массива пропал шаблон строки', () => {
    const report = run(loanIntent('renderer-json'), (document) => {
      delete (document.parts as Record<string, unknown>).propertiesRow;
    });
    expect(report.errors.map((e) => e.code)).toContain('C8');
  });

  it('C1 — путь внутри части считается от группы, к которой она подключена', () => {
    // `street` есть у обеих групп; уберём его у одной — часть, подключённая к ней, обязана
    // это заметить, хотя сам текст части не менялся.
    const intent = loanIntent('renderer-json');
    intent.fields = intent.fields.filter((f) => f.name !== 'residence.street');
    const report = run(intent);
    expect(report.errors.map((e) => e.code)).toContain('C1');
    expect(report.errors.map((e) => e.message).join(' ')).toContain('residence.street');
  });
});

describe('validate_form kind=code — прежний контракт', () => {
  const codes = async (code: string) =>
    (await validateCode(k, code)).diagnostics.map((d) => `${d.code}:${d.severity}`);

  it('сгенерированные файлы проходят без диагностик', async () => {
    for (const target of TARGETS) {
      for (const file of buildBundle(loanIntent(target)).files) {
        const { diagnostics } = await validateCode(k, file.content);
        expect(
          diagnostics.map((d) => `${d.code} ${d.message}`),
          `${target}/${file.path}`
        ).toEqual([]);
      }
      const { diagnostics } = await validateCode(k, buildAssemblyTsx(loanIntent(target)));
      expect(
        diagnostics.map((d) => `${d.code} ${d.message}`),
        `${target}/index.tsx`
      ).toEqual([]);
    }
  });

  it('прежние фабрики сборки — RF010 с адресом замены', async () => {
    const code = [
      "import { createReactForm, useReactForm } from '@reformer/renderer-react';",
      'const form = useReactForm(() => createReactForm({ model, schema }));',
    ].join('\n');
    const { diagnostics } = await validateCode(k, code);
    const rf010 = diagnostics.filter((d) => d.code === 'RF010');
    expect(rf010.map((d) => d.message).join('\n')).toMatch(/createReactForm/);
    expect(rf010.map((d) => d.suggestion).join('\n')).toMatch(/createForm/);
    expect(
      rf010.every((d) => d.severity === 'warning'),
      'прежнее API ещё работает'
    ).toBe(true);
    expect(rf010[0].fix).toEqual({ tool: 'find_recipe', arguments: { topic: 'unified-contract' } });
  });

  it('прежние ключи узла — RF010', async () => {
    expect(await codes('{ value: model.$.loanType, component: Select },')).toContain(
      'RF010:warning'
    );
    expect(await codes('{ array: model.properties, item },')).toContain('RF010:warning');
    expect(await codes('{ "value": "$model(loanType)" }')).toContain('RF010:warning');
    // Ключ нового контракта претензий не вызывает.
    expect(await codes('{ model: model.$.loanType, component: Select },')).toEqual([]);
  });

  it('apply и applyEach — операторы и валидации, и поведения', async () => {
    const validation = [
      "import { apply, applyEach, defineValidationSchema } from '@reformer/core/validation';",
      'export const rules = defineValidationSchema<Form>(({ model }) => {',
      '  apply(model.$.address, addressRules);',
      '  applyEach(model.$.items, itemRules);',
      '});',
    ].join('\n');
    expect(await codes(validation)).toEqual([]);

    const behavior = [
      "import { applyEach, defineFormBehavior, hideWhen, onMount } from '@reformer/core/behaviors';",
      'export const behavior = defineFormBehavior<Form>(({ model, schema }) => {',
      "  hideWhen(schema.node('mortgage'), () => !model.flag);",
      "  onMount(schema.node('boundary'), () => undefined);",
      '  applyEach(model.$.items, itemBehavior);',
      '});',
    ].join('\n');
    expect(await codes(behavior)).toEqual([]);
  });
});

describe('бандл компилируется с реальными типами @reformer/*', () => {
  for (const target of TARGETS) {
    it(
      target,
      async () => {
        const ts = (await import('typescript')).default;
        mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
        const dir = mkdtempSync(join(process.cwd(), '.tmp', `unified-contract-${target}-`));
        try {
          const intent = loanIntent(target);
          const entries: string[] = [];
          const write = (path: string, content: string) => {
            const file = join(dir, path);
            writeFileSync(file, content);
            entries.push(file);
          };
          for (const file of buildBundle(intent).files) write(file.path, file.content);
          // Справочник пишет консумент — в бандл он не входит.
          write(
            'data-sources.ts',
            "export const LOAN_TYPES = [{ value: 'mortgage', label: 'Ипотека' }];\n"
          );
          write('index.tsx', buildAssemblyTsx(intent));

          const program = ts.createProgram(entries, {
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            esModuleInterop: true,
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            target: ts.ScriptTarget.ES2022,
            baseUrl: process.cwd(),
          });
          const diagnostics = program
            .getSemanticDiagnostics()
            .concat(program.getSyntacticDiagnostics())
            .map(
              (d) =>
                `${d.file?.fileName.slice(dir.length + 1) ?? ''}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
            );
          expect(diagnostics).toEqual([]);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      },
      60_000
    );
  }
});
