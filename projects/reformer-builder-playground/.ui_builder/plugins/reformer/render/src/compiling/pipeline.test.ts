/**
 * Путь компилирующей поверхности целиком: прочитать модуль → исполнить → разобрать контракт →
 * собрать форму.
 *
 * Отдельно от компонента намеренно: DOM здесь не нужен вовсе, а проверяется ровно то, ради чего
 * поверхность существует, — что начальные значения, правила, поток шагов и поведение модуля
 * доезжают до собранной формы, а не теряются по дороге.
 *
 * Основной путь — модуль в раскладке «папки по ролям»; модуль прежней плоской раскладки
 * проверяется как запасной.
 *
 * @module plugins/reformer/render/compiling/pipeline.test
 */

import { describe, expect, it } from 'vitest';
import * as behaviors from '@reformer/core/behaviors';
import * as validation from '@reformer/core/validation';
import * as validators from '@reformer/core/validators';
import * as rendererJson from '@reformer/renderer-json';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { sampleSchema } from '../../../core/testing';
import { toDescriptor } from '@reformer/builder-plugin-api';
import type { PreviewModules } from '../host';
import { buildRuntimeBundle } from '../runtime/build';
import { createFakeHost, createFakeModules } from '../testing';
import { compileForm } from './compile';
import { extractContract, appliedArtifacts, runFactories } from './exports';
import { alignFlow } from './flow';
import { moduleFilesFor, planModule } from './module';
import { readSidecars } from './read';

/** Загрузчик без транспиляции: сайдкары написаны на CommonJS, чтобы движок был не нужен. */
const modules: PreviewModules = {
  load: (files, entry) => {
    const evaluated = new Map<string, unknown>();
    // Резолв расширения — как у настоящего линковщика: `./model` обязан найти `model.ts`,
    // иначе тест проверял бы не то, что происходит в приложении.
    const resolve = (name: string): string => {
      for (const candidate of [name, `${name}.ts`, `${name}.tsx`]) {
        if (files.has(candidate)) return candidate;
      }
      throw new Error(`нет модуля ${name}`);
    };
    const load = (specifier: string): unknown => {
      const name = resolve(specifier);
      const cached = evaluated.get(name);
      if (cached !== undefined) return cached;
      const source = files.get(name);
      if (source === undefined) throw new Error(`нет модуля ${name}`);
      const module: { exports: unknown } = { exports: {} };
      const require = (specifier: string): unknown => load(specifier.replace('./', ''));
      new Function('exports', 'require', 'module', source)(module.exports, require, module);
      evaluated.set(name, module.exports);
      return module.exports;
    };
    return Promise.resolve({ entry: load(entry), modules: evaluated, errors: [] });
  },
};

const SIDECARS = {
  'model.ts': 'module.exports.initialFormModel = { loanType: "ипотека" };',
  'validation.ts':
    'var model = require("./model");\n' +
    'module.exports.formValidation = { loanType: [] };\n' +
    'module.exports.validationOptions = { strategy: "change" };\n' +
    'module.exports.seenModel = model.initialFormModel;',
  'index.tsx': 'throw new Error("страницу-обёртку исполнять нельзя");',
  'validation.test.ts': 'throw new Error("тесты исполнять нельзя");',
};

describe('путь компилирующей поверхности', () => {
  it('исполняет сайдкары и доводит их значения до собранной формы', async () => {
    const host = createFakeHost({ siblings: SIDECARS, source: { executesCode: true } });
    const sources = await readSidecars(host, 'fake:form/form.json');
    const compiled = await compileForm(sources.files, modules);
    expect(compiled.problems).toEqual([]);

    const contract = extractContract(compiled.modules);
    expect(appliedArtifacts(contract)).toEqual(['model', 'validation']);
    expect(contract.validation).toEqual({ rules: { loanType: [] }, strategy: 'change' });

    const bundle = buildRuntimeBundle({
      schema: sampleSchema(),
      catalog: [],
      descriptor: toDescriptor({ version: '1.0', components: [] }),
      namespace: {},
      mock: null,
      initialOverride: runFactories(contract).initial,
      behavior: contract.behavior,
      validation: contract.validation,
    });
    expect(bundle.problems).toEqual([]);
    expect(bundle.form?.model.get()).toMatchObject({ loanType: 'ипотека' });
  });

  it('общий импорт исполняется ОДИН раз: иначе у формы было бы две разные модели', async () => {
    const host = createFakeHost({ siblings: SIDECARS, source: { executesCode: true } });
    const sources = await readSidecars(host, 'fake:form/form.json');
    const compiled = await compileForm(sources.files, modules);
    const model = compiled.modules.get('model.ts') as { initialFormModel: unknown };
    const validation = compiled.modules.get('validation.ts') as { seenModel: unknown };
    expect(validation.seenModel).toBe(model.initialFormModel);
  });

  it('страница-обёртка и тесты в набор не попадают', async () => {
    const host = createFakeHost({ siblings: SIDECARS });
    const sources = await readSidecars(host, 'fake:form/form.json');
    expect([...sources.files.keys()].sort()).toEqual(['model.ts', 'validation.ts']);
  });
});

/** Пакеты, которые код модуля берёт у оболочки, — те же объекты, которыми собирает форму превью. */
const PACKAGES = {
  '@reformer/core/behaviors': behaviors,
  '@reformer/core/validation': validation,
  '@reformer/core/validators': validators,
  '@reformer/renderer-json': rendererJson,
};

const DESCRIPTOR = toDescriptor({ version: '1.0', components: [] });

/** Живая схема редактора: визард из двух шагов; селекторы — те, что проставляет кодоген. */
const WIZARD_SCHEMA = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Wizard)',
        selector: 'wizard',
        children: [
          {
            component: '$component(Step)',
            selector: 'shag-1-section',
            componentProps: { title: 'Шаг 1' },
            children: [{ model: '$model(email)', component: '$component(Input)' }],
          },
          {
            component: '$component(Step)',
            selector: 'shag-2-section',
            componentProps: { title: 'Шаг 2' },
            children: [{ model: '$model(comment)', component: '$component(Input)' }],
          },
        ],
      },
    ],
  },
} as unknown as JsonFormSchema;

const DOCUMENT = 'fake:forms/zayavka/schema/form.schema.json';
const DOCUMENT_PATH = 'forms/zayavka/schema/form.schema.json';

/**
 * Модуль формы в раскладке «папки по ролям» — те же файлы и экспорты, что печатает кодоген
 * (набор `wizard-split`), только на CommonJS. Файлы, которые превью исполнять не вправе, бросают:
 * исполни их кто-нибудь — компиляция принесла бы находку.
 */
const ROLES_MODULE: Record<string, string> = {
  'forms/zayavka/schema/form.schema.json': '{ "документ": "берётся из модели редактора" }',
  'forms/zayavka/schema/steps/shag-1/form.schema.json': '{ "node": {} }',
  'forms/zayavka/ZayavkaForm.tsx': 'throw new Error("страницу исполнять нельзя");',
  'forms/zayavka/index.ts': 'throw new Error("вход модуля исполнять нельзя");',
  'forms/zayavka/README.md': '# Заявка',
  'forms/zayavka/fixture.ts': 'throw new Error("фикстура — отдельный граф");',
  'forms/zayavka/application/create.ts': 'throw new Error("сборку приложения исполнять нельзя");',
  'forms/zayavka/application/entry.ts': 'throw new Error("запись реестра исполнять нельзя");',
  'forms/zayavka/application/submit.ts':
    'var behaviors = require("@reformer/core/behaviors");\n' +
    'var api = require("../api");\n' +
    'exports.wireSubmit = function (scope, options) {\n' +
    '  behaviors.onComponentEvent(scope.schema.node("wizard"), "onSubmit", function (values) {\n' +
    '    return api.submitForm(values).then(function (result) {\n' +
    '      if (options.onResult) options.onResult("Форма отправлена", result.success);\n' +
    '    });\n' +
    '  });\n' +
    '};',
  'forms/zayavka/api/index.ts':
    'exports.loaded = (globalThis.__apiLoads = (globalThis.__apiLoads || 0) + 1);\n' +
    'exports.submitForm = function () { return Promise.resolve({ success: true }); };',
  'forms/zayavka/model/initial-value.ts':
    'exports.createInitialValues = function () { return { email: "", comment: "из модуля" }; };',
  'forms/zayavka/model/model.ts': 'throw new Error("фабрику модели превью не зовёт");',
  'forms/zayavka/types/zayavka.ts': 'throw new Error("типы исполнять незачем");',
  'forms/zayavka/constants/zayavka.ts': 'exports.CITIES = [];',
  'forms/zayavka/validation/form.ts': 'exports.formValidation = {};',
  'forms/zayavka/validation/shag-1.ts':
    'var v = require("@reformer/core/validation");\n' +
    'var rules = require("@reformer/core/validators");\n' +
    'exports.stepRules = v.defineValidation(function (scope) {\n' +
    '  v.validate(scope.model.$.email, [rules.required()]);\n' +
    '});',
  'forms/zayavka/flow/zayavka-flow.ts':
    'var step = require("../validation/shag-1");\n' +
    'exports.formFlow = { steps: [{ id: "shag-1-section", rules: step.stepRules }] };',
  'forms/zayavka/behavior/index.ts':
    'var behaviors = require("@reformer/core/behaviors");\n' +
    'exports.behaviorRules = function (scope) {\n' +
    '  behaviors.hideWhen(scope.schema.node("shag-2-section"), function () { return false; });\n' +
    '};\n' +
    'exports.formBehavior = behaviors.defineFormBehavior(exports.behaviorRules);',
  'forms/zayavka/schema/registry.ts':
    'var constants = require("../constants/zayavka");\n' +
    'var rj = require("@reformer/renderer-json");\n' +
    'exports.createRegistry = function () {\n' +
    '  return rj.defineRegistry(function (reg) { reg.dataSource("CITIES", constants.CITIES); });\n' +
    '};',
};

/** Прочитать, исполнить и разобрать модуль — ровно те шаги, что делает поверхность. */
async function compileModule(tree: Record<string, string>, document: string, path: string) {
  const host = createFakeHost({ tree, source: { executesCode: true } });
  const sources = await readSidecars(host, document);
  const plan = planModule(sources.resources.keys(), moduleFilesFor(path));
  const compiled = await compileForm(sources.files, createFakeModules(PACKAGES), {}, plan);
  const contract = extractContract(compiled.modules, plan);
  return { sources, plan, compiled, contract };
}

describe('модуль в раскладке «папки по ролям»', () => {
  it('читается от корня модуля — родителя папки schema/', async () => {
    const { sources } = await compileModule(ROLES_MODULE, DOCUMENT, DOCUMENT_PATH);

    expect(sources.problems).toEqual([]);
    expect([...sources.files.keys()]).toEqual(
      expect.arrayContaining([
        'application/submit.ts',
        'api/index.ts',
        'behavior/index.ts',
        'flow/zayavka-flow.ts',
        'model/initial-value.ts',
        'schema/registry.ts',
        'schema/steps/shag-1/form.schema.json',
        'validation/form.ts',
        'validation/shag-1.ts',
      ])
    );
    // Документ — из модели редактора, вход модуля и фикстура в набор не идут вовсе.
    expect(sources.files.has('schema/form.schema.json')).toBe(false);
    expect(sources.files.has('index.ts')).toBe(false);
    expect(sources.files.has('fixture.ts')).toBe(false);
    expect(sources.resources.get('validation/form.ts')).toBe(
      'fake:forms/zayavka/validation/form.ts'
    );
  });

  it('исполняются файлы ролей; страница и сборка приложения — нет', async () => {
    const { compiled } = await compileModule(ROLES_MODULE, DOCUMENT, DOCUMENT_PATH);

    // Исполни превью страницу, `application/create.ts` или фабрику модели — здесь была бы находка.
    expect(compiled.problems).toEqual([]);
    expect([...compiled.modules.keys()]).toEqual([
      'model/initial-value.ts',
      'validation/form.ts',
      'flow/zayavka-flow.ts',
      'behavior/index.ts',
      'application/submit.ts',
      'schema/registry.ts',
    ]);
  });

  it('контракт экспортов по ролям разобран целиком и помнит файлы', async () => {
    const { contract } = await compileModule(ROLES_MODULE, DOCUMENT, DOCUMENT_PATH);

    expect(appliedArtifacts(contract)).toEqual([
      'model',
      'validation',
      'flow',
      'behavior',
      'submit',
      'registry',
    ]);
    expect(contract.files).toEqual({
      initial: 'model/initial-value.ts',
      validation: 'validation/form.ts',
      flow: 'flow/zayavka-flow.ts',
      behavior: 'behavior/index.ts',
      submit: 'application/submit.ts',
      registry: 'schema/registry.ts',
    });
  });

  it('значения, поток шагов и отправка доезжают до собранной формы', async () => {
    const { contract } = await compileModule(ROLES_MODULE, DOCUMENT, DOCUMENT_PATH);
    const values = runFactories(contract);
    expect(values.problems).toEqual([]);
    if (contract.behaviorRules === undefined || contract.wireSubmit === undefined) {
      throw new Error('модуль не отдал половины поведения');
    }

    const bundle = buildRuntimeBundle({
      schema: WIZARD_SCHEMA,
      catalog: [],
      descriptor: DESCRIPTOR,
      namespace: {},
      mock: null,
      extraRegistry: values.registry,
      initialOverride: values.initial,
      behavior: contract.behavior,
      moduleBehavior: { rules: contract.behaviorRules, wireSubmit: contract.wireSubmit },
      validation: contract.validation,
      flow: alignFlow(contract.flow, WIZARD_SCHEMA),
      files: contract.files,
    });

    // Отправка привязалась к узлу визарда живой схемы: находки о потерянном узле нет.
    expect(bundle.problems).toEqual([]);
    const form = bundle.form;
    if (form === null) throw new Error('форма не собралась');
    // Начальные значения модуля легли поверх синтезированного мока.
    expect(form.model.get()).toMatchObject({ email: '', comment: 'из модуля' });

    // «Далее» проверяет правила шага потоком сборки: пустой обязательный шаг не проходит.
    const flow = form.flow;
    if (flow === undefined) throw new Error('поток шагов не дошёл до сборки');
    await expect(flow.next()).resolves.toMatchObject({ status: 'stayed', reason: 'invalid' });
    expect(flow.current.value).toBe('shag-1-section');

    form.form.email.setValue('anya@example.com');
    // Второго шага в потоке модуля нет (код не перегенерировали) — он взят из живой схемы.
    await expect(flow.next()).resolves.toMatchObject({ status: 'moved', to: 'shag-2-section' });
  });

  it('общий импорт исполняется ОДИН раз и в раскладке по ролям', async () => {
    const globals = globalThis as { __apiLoads?: number };
    globals.__apiLoads = 0;
    await compileModule(ROLES_MODULE, DOCUMENT, DOCUMENT_PATH);
    // `api/index.ts` импортирует отправка; затребуй его ещё и точка входа — исполнился бы дважды.
    expect(globals.__apiLoads).toBe(1);
    delete globals.__apiLoads;
  });

  it('битый файл одной роли не лишает превью остальных и назван путём от корня модуля', async () => {
    const tree = {
      ...ROLES_MODULE,
      'forms/zayavka/behavior/index.ts': 'throw new Error("поведение сломано");',
    };
    const { compiled, contract, sources } = await compileModule(tree, DOCUMENT, DOCUMENT_PATH);

    expect(compiled.problems).toEqual([
      { file: 'behavior/index.ts', phase: 'evaluate', message: 'поведение сломано' },
    ]);
    expect(appliedArtifacts(contract)).toEqual(['model', 'validation', 'flow', 'registry']);
    // По этому пути находка получит адрес файла, а не схемы.
    expect(sources.resources.get('behavior/index.ts')).toBe('fake:forms/zayavka/behavior/index.ts');
  });

  it('папку формы переименовали без регенерации — поток находится по папке роли', async () => {
    const renamed = Object.fromEntries(
      Object.entries(ROLES_MODULE).map(([path, text]) => [
        path.replace('forms/zayavka/', 'forms/credit/'),
        text,
      ])
    );
    const { contract } = await compileModule(
      renamed,
      'fake:forms/credit/schema/form.schema.json',
      'forms/credit/schema/form.schema.json'
    );

    expect(contract.files.flow).toBe('flow/zayavka-flow.ts');
    expect(contract.flow?.steps.map((step) => step.id)).toEqual(['shag-1-section']);
  });
});

/**
 * Модуль прежней плоской раскладки и прежнего контракта: всё в корне, шаги — в `steps/<шаг>/`,
 * отправку и правила узлов несёт `form.render.ts`.
 */
const FLAT_MODULE: Record<string, string> = {
  'forms/contact/form.schema.json': '{}',
  'forms/contact/index.tsx': 'throw new Error("страницу-обёртку исполнять нельзя");',
  'forms/contact/model.ts':
    'exports.createInitialValues = function () { return { loanType: "ипотека" }; };',
  'forms/contact/form.validation.ts':
    'var steps = require("./steps");\n' +
    'exports.formValidation = { loanType: [] };\n' +
    'exports.stepCount = steps.stepValidations.length;',
  'forms/contact/steps/index.ts':
    'var first = require("./kredit/form.validation");\n' +
    'exports.stepValidations = [first.stepValidation];',
  'forms/contact/steps/kredit/form.validation.ts': 'exports.stepValidation = {};',
  'forms/contact/form.render.ts':
    'exports.createJsonRenderBehavior = function (form, model) {\n' +
    '  return function (schema) { globalThis.__flatRender = typeof schema.node; };\n' +
    '};',
  'forms/contact/registry.ts': 'exports.createRegistry = function () { return undefined; };',
};

describe('модуль прежней плоской раскладки — запасной путь', () => {
  const FLAT_DOCUMENT = 'fake:forms/contact/form.schema.json';
  const FLAT_PATH = 'forms/contact/form.schema.json';

  it('читается от каталога документа и исполняется корнем, шаги — по импортам', async () => {
    const { sources, plan, compiled } = await compileModule(FLAT_MODULE, FLAT_DOCUMENT, FLAT_PATH);

    expect(plan.layout).toBe('flat');
    expect(sources.files.has('steps/kredit/form.validation.ts')).toBe(true);
    expect(sources.files.has('index.tsx')).toBe(false);
    expect(compiled.problems).toEqual([]);
    // Файлы папок шагов исполнены как импорты, но в разбор контракта не выставлены.
    expect([...compiled.modules.keys()].sort()).toEqual([
      'form.render.ts',
      'form.validation.ts',
      'model.ts',
      'registry.ts',
    ]);
    expect(compiled.modules.get('form.validation.ts')).toMatchObject({ stepCount: 1 });
  });

  it('контракт прежнего слоя оживает: значения модели и правила узлов применяются', async () => {
    const { contract } = await compileModule(FLAT_MODULE, FLAT_DOCUMENT, FLAT_PATH);
    expect(appliedArtifacts(contract)).toEqual([
      'model',
      'validation',
      'renderBehavior',
      'registry',
    ]);
    expect(contract.files.renderBehavior).toBe('form.render.ts');

    const globals = globalThis as { __flatRender?: string };
    delete globals.__flatRender;
    const bundle = buildRuntimeBundle({
      schema: sampleSchema(),
      catalog: [],
      descriptor: DESCRIPTOR,
      namespace: {},
      mock: null,
      initialOverride: runFactories(contract).initial,
      validation: contract.validation,
      renderBehavior: contract.renderBehavior,
      files: contract.files,
    });

    expect(bundle.problems).toEqual([]);
    // `createInitialValues` прежнего `model.ts` — то же имя, что печатает кодоген сейчас.
    expect(bundle.form?.model.get()).toMatchObject({ loanType: 'ипотека' });
    expect(globals.__flatRender).toBe('function');
    delete globals.__flatRender;
  });
});
