import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
// Канон раскладки берётся из самого MCP-сервера (`FORM_LAYOUT_CANON` + та же проверка, что стоит
// у консумента как `validate_form kind="layout"`), а не переписывается сюда списком имён: копия —
// это второй источник истины, и расходится он молча.
import { validateLayout } from '@reformer/mcp/dist/core/validate/layout.js';
import { synthMock } from '../preview-runtime/mock-synth';
import { buildExampleFiles, makeNames, appSnippet, validateExportable } from './index';
import { emitIndex } from './emit-index';
import { exampleSchema } from './__fixtures__/example-schema';
import { wizardSchema } from './__fixtures__/wizard-schema';

const rawSchema = exampleSchema;

const mock = synthMock(rawSchema, { now: new Date('2026-01-01T00:00:00Z') });
const files = buildExampleFiles(rawSchema, mock, 'loan');
const byPath = (p: string) => files.find((f) => f.path === p)!;

describe('buildExampleFiles — правила доходят до файлов', () => {
  // Сквозная проверка того же пути, которым идёт экспорт в папку пользователя: правила,
  // поставленные агентом, обязаны оказаться в validation.ts. Без неё разрыв между «агент
  // отчитался» и «в проекте лежит заглушка с TODO» ничем не ловится.
  const rules = {
    validation: [{ target: 'amount', rules: ['required'] }],
    behavior: [],
    visibility: [],
  };

  it('с правилами validation.ts содержит правило, а не заглушку', () => {
    const withRules = buildExampleFiles(rawSchema, mock, 'loan', rules);
    const src = withRules.find((f) => f.path === 'validation.ts')!.content;
    expect(src).toContain('amount');
    expect(src).toContain('required');
    // Маркер «МОК» — обещание пользователю, что правила ВЫДУМАНЫ по схеме и их надо дописать.
    // Когда правила настоящие, обещание становится ложью.
    expect(src).not.toContain('МОК');
  });

  it('без правил остаётся прежняя заглушка, помеченная как мок', () => {
    const src = files.find((f) => f.path === 'validation.ts')!.content;
    expect(src).toContain('МОК');
  });
});

describe('buildExampleFiles — набор файлов', () => {
  it('11 файлов, ожидаемые пути, схема — единственный JSON', () => {
    expect(files.map((f) => f.path).sort()).toEqual(
      [
        'api.ts',
        'data-sources.ts',
        'form.behavior.ts',
        'index.tsx',
        'model.ts',
        'README.md',
        'registry.ts',
        'renderer.behavior.ts',
        'renderer.schema.json',
        'types.ts',
        'validation.ts',
      ].sort()
    );
    // Схема — JSON, а не TS-литерал: так экспортированный пример открывается обратно в canvas
    // билдера, а набор файлов совпадает с тем, что дают встроенные шаблоны.
    expect(files.filter((f) => f.path.endsWith('.json')).map((f) => f.path)).toEqual([
      'renderer.schema.json',
    ]);
  });

  // Канон раскладки renderer-json (@reformer/mcp docs/llms/06-form-directory-layout.md §1) — это
  // ВЕСЬ модуль: роли без своего файла в набор не добавляются. Тест держит границу — прошлый раз
  // запись реестра форм уехала в собственный `entry.ts`, а канон читает это имя как неканоничное
  // имя точки входа и требует слить с `index.tsx`.
  it('набор проходит канон раскладки renderer-json', () => {
    const { diagnostics } = validateLayout(
      files.map((f) => f.path),
      'renderer-json'
    );
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  // Два осознанных отступления, и оба — решения, а не случайности: схема как данные
  // (`renderer.schema.json` вместо `.ts`) нужна, чтобы пример открывался обратно в билдере;
  // README держит шаги интеграции. Список закрыт — новое предупреждение обязано быть обсуждено.
  it('предупреждений канона ровно два: схема как данные и README', () => {
    const { diagnostics } = validateLayout(
      files.map((f) => f.path),
      'renderer-json'
    );
    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    expect(warnings.map((w) => w.path).sort()).toEqual(['README.md', 'renderer.schema.json']);
  });

  it('класс derived/user проставлен верно', () => {
    const derived = files
      .filter((f) => f.cls === 'derived')
      .map((f) => f.path)
      .sort();
    const user = files
      .filter((f) => f.cls === 'user')
      .map((f) => f.path)
      .sort();
    expect(derived).toEqual(
      [
        'README.md',
        'index.tsx',
        'model.ts',
        'registry.ts',
        'renderer.schema.json',
        'types.ts',
      ].sort()
    );
    expect(user).toEqual(
      [
        'api.ts',
        'data-sources.ts',
        'form.behavior.ts',
        'renderer.behavior.ts',
        'validation.ts',
      ].sort()
    );
  });
});

describe('renderer.schema.json — селекторы + submit впечены', () => {
  const src = byPath('renderer.schema.json').content;
  it('валидный JSON с шапкой $schema/version — дискавери даёт бейдж high', () => {
    const json = JSON.parse(src) as { $schema: string; version: string; root: unknown };
    expect(json.$schema).toBe('./form-schema.schema.json');
    expect(json.version).toBe('1.0');
    expect(json.root).toBeTruthy();
  });
  it('вставлен submit-Button и selector-ы секции/массива', () => {
    expect(src).toContain('"selector": "submit"');
    expect(src).toContain('$component(Button)');
    expect(src).toContain('"zayavka-section"');
    expect(src).toContain('"items"');
  });
});

describe('registry.ts — привязки', () => {
  const src = byPath('registry.ts').content;
  it('FIELD_WRAPPER + field→Field + Button + импорт data-sources', () => {
    expect(src).toContain('reg.component(FIELD_WRAPPER, FormField)');
    expect(src).toContain('SelectField');
    expect(src).toContain('InputField');
    expect(src).toContain('CheckboxField');
    expect(src).toContain("reg.component('Button', Button)");
    expect(src).toContain("reg.dataSource('LOAN_TYPES', LOAN_TYPES)");
    expect(src).toContain("reg.dataSource('ITEM_LABEL', ITEM_LABEL)");
    expect(src).toContain("from './data-sources'");
  });
});

describe('types.ts — типы', () => {
  const src = byPath('types.ts').content;
  it('union для select, скалярные типы, массив', () => {
    expect(src).toContain('export type LoanForm =');
    expect(src).toContain("'option1'"); // union из синтетических опций
    expect(src).toContain('amount: number');
    expect(src).toContain('agree: boolean');
    expect(src).toContain('items: Array<{');
  });
});

describe('model.ts / data-sources.ts / behavior / validation / api', () => {
  it('model.ts — фабрика + initialValues', () => {
    const src = byPath('model.ts').content;
    expect(src).toContain('export function createLoanFormModel');
    expect(src).toContain('createInitialValues');
    expect(src).toContain('"loanType"');
  });
  it('data-sources.ts — опции из мока + itemLabel-стаб', () => {
    const src = byPath('data-sources.ts').content;
    expect(src).toContain('export const LOAN_TYPES: SelectOption[]');
    expect(src).toContain('export const ITEM_LABEL =');
    expect(src).toContain("import type { SelectOption } from './types'");
  });
  it('renderer.behavior.ts — submit + hideWhen scaffold', () => {
    const src = byPath('renderer.behavior.ts').content;
    expect(src).toContain('submitForm');
    expect(src).toContain("schema.node('submit')");
    expect(src).toContain("hideWhen(schema.node('zayavka-section')");
  });
  it('validation.ts — required из схемы', () => {
    const src = byPath('validation.ts').content;
    expect(src).toContain('model.$.loanType');
    expect(src).toContain('model.$.agree');
    expect(src).toContain('required(');
  });
  it('api.ts — submitForm стаб', () => {
    const src = byPath('api.ts').content;
    expect(src).toContain('export async function submitForm');
    expect(src).toContain('ApiResult');
  });
  it('form.behavior.ts — defineFormBehavior', () => {
    expect(byPath('form.behavior.ts').content).toContain('defineFormBehavior<LoanForm>');
  });
  it('index.tsx — сборка формы ОДНИМ вызовом, без отдельного пропа поведения', () => {
    const src = byPath('index.tsx').content;
    expect(src).toContain('createJsonForm<LoanForm>(');
    expect(src).toContain('useJsonForm(');
    expect(src).toContain('form={jsonForm}');
    // Поведение — поле конфига; проп рендерера и useMemo вокруг него больше не эмитятся.
    expect(src).toContain('renderBehavior: (form, model) =>');
    expect(src).not.toContain('renderBehavior={');
    expect(src).not.toContain('useMemo');
  });

  it('README.md — сниппет + чеклист', () => {
    const src = byPath('README.md').content;
    expect(src).toContain('LoanPage');
    expect(src).toContain("import LoanPage from './pages/examples/loan'");
    expect(src).toContain('zayavka-section');
  });
});

describe('детерминизм', () => {
  it('два прогона с тем же моком байт-идентичны', () => {
    const a = buildExampleFiles(rawSchema, mock, 'loan');
    const b = buildExampleFiles(rawSchema, mock, 'loan');
    expect(a).toEqual(b);
  });
});

describe('naming / snippet / validateExportable', () => {
  it('makeNames', () => {
    const n = makeNames('loan-application');
    expect(n.dir).toBe('loan-application');
    expect(n.TypeName).toBe('LoanApplicationForm');
    expect(n.pageComponent).toBe('LoanApplicationPage');
    expect(n.routePath).toBe('/examples/loan-application');
  });
  it('appSnippet — 3 части', () => {
    const s = appSnippet(makeNames('loan'));
    expect(s).toContain("import LoanPage from './pages/examples/loan'");
    expect(s).toContain('<Route path="/examples/loan"');
  });
  it('validateExportable — пропуск $model в моке даёт warning', () => {
    const bare = {
      version: '1.0',
      root: {
        component: '$html(div)',
        children: [{ value: '$model(missing)', component: '$component(Input)' }],
      },
    } as unknown as JsonFormSchema;
    const rep = validateExportable(bare, { model: {}, dataSources: {} });
    expect(rep.warnings.some((w) => w.includes('missing'))).toBe(true);
  });
});

describe('запись реестра форм — в index.tsx, отдельного файла у неё нет', () => {
  const n = makeNames('loan');
  const code = byPath('index.tsx').content;

  it('объявляет FormEntry с id примера и версией', () => {
    expect(code).toContain(`export const ${n.entryConst}: FormEntry<${n.TypeName}>`);
    expect(code).toContain(`id: '${n.exampleId}'`);
    expect(code).toContain("version: '1.0.0'");
    expect(code).toContain('owner:');
  });

  it('схема объявлена ДАННЫМИ, остальное — кодом', () => {
    // Граница «данные/код» — суть модели: схему можно доставить по сети, код нельзя.
    expect(code).toContain("schema: { kind: 'inline', value: typedSchema }");
    expect(code).toContain("registry: { kind: 'inline', value: createRegistry() }");
    expect(code).toContain("behavior: { kind: 'inline', value: formBehavior }");
    expect(code).toContain('renderBehavior: {');
    expect(code).toContain('createJsonRenderBehavior(form, model, options');
    // http для кода отсутствует в типах — проверяем, что эмиттер его и не пытается выдать.
    expect(code).not.toContain("kind: 'http'");
  });

  it('переиспользует импорты и каст схемы страницы — без дубля', () => {
    expect(code).toContain("import type { FormEntry } from '@reformer/form-registry';");
    for (const imp of [
      `import { ${n.modelFactory} } from './model';`,
      "import { createRegistry } from './registry';",
      "import { formBehavior } from './form.behavior';",
      "import { createJsonRenderBehavior } from './renderer.behavior';",
    ]) {
      expect(code.split(imp)).toHaveLength(2);
    }
    expect(code.split('const typedSchema =')).toHaveLength(2);
  });

  it('помечен как derived — им владеет машина', () => {
    expect(files.find((f) => f.path === 'index.tsx')?.cls).toBe('derived');
  });
});

describe('appSnippet — регистрация вместо копипасты', () => {
  it('первым способом предлагает реестр: одна строка вместо трёх шагов', () => {
    const s = appSnippet(makeNames('loan application'));
    expect(s).toContain('getFormRegistry().register(');
    expect(s).toContain('FormOutlet');
    // Ручной путь остаётся — но вторым, для приложений без реестра.
    expect(s).toContain('<Route path=');
  });
});

describe('index.tsx — сгенерированный код КОМПИЛИРУЕТСЯ', () => {
  it('index.tsx проходит tsc в связке с реальными типами пакетов', async () => {
    // Все прочие тесты проверяют вхождение подстрок — они не отличают валидный TypeScript от
    // мусора. Именно поэтому мимо них прошло несовпадение сигнатуры renderBehavior: реестр
    // третьим аргументом отдаёт валидацию, а createJsonRenderBehavior ждёт там настройки.
    const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ts = (await import('typescript')).default;

    // Песочница ВНУТРИ репозитория: снаружи @reformer/* не резолвятся, контекстный тип
    // FormEntry теряется, и tsc сыплет ложными implicit-any вместо настоящих ошибок.
    mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
    const dir = mkdtempSync(join(process.cwd(), '.tmp', 'emit-index-'));
    try {
      const names = makeNames('loan application');
      // Соседи-заглушки: проверяем ИМЕННО index.tsx, а не весь сгенерированный набор.
      writeFileSync(join(dir, 'renderer.schema.json'), '{ "root": {} }\n');
      writeFileSync(
        join(dir, 'registry.ts'),
        "import { defineRegistry } from '@reformer/renderer-json';\n" +
          'export const createRegistry = () => defineRegistry(() => {});\n'
      );
      writeFileSync(
        join(dir, 'types.ts'),
        `export interface ${names.TypeName} { field: string }\n`
      );
      writeFileSync(
        join(dir, 'model.ts'),
        "import { createModel } from '@reformer/core';\n" +
          `import type { ${names.TypeName} } from './types';\n` +
          `export const ${names.modelFactory} = () => createModel<${names.TypeName}>({ field: '' });\n`
      );
      writeFileSync(
        join(dir, 'form.behavior.ts'),
        "import { defineFormBehavior } from '@reformer/core/behaviors';\n" +
          `import type { ${names.TypeName} } from './types';\n` +
          `export const formBehavior = defineFormBehavior<${names.TypeName}>(() => {});\n`
      );
      writeFileSync(
        join(dir, 'renderer.behavior.ts'),
        "import type { RenderBehaviorFn } from '@reformer/renderer-react';\n" +
          "import type { FormProxy, FormModel } from '@reformer/core';\n" +
          `import type { ${names.TypeName} } from './types';\n` +
          'export type RenderBehaviorOptions = { onResult?: (message: string, ok: boolean) => void };\n' +
          'export function createJsonRenderBehavior(\n' +
          `  _form: FormProxy<${names.TypeName}>,\n` +
          `  _model: FormModel<${names.TypeName}>,\n` +
          '  _options: RenderBehaviorOptions = {}\n' +
          `): RenderBehaviorFn<${names.TypeName}> {\n  return () => {};\n}\n`
      );
      // `import.meta.env.DEV` в целевом проекте типизирует `vite/client`; здесь — минимальный шим,
      // иначе проп `validateSchema` даст ложную ошибку типов вместо настоящих.
      writeFileSync(
        join(dir, 'env.d.ts'),
        'interface ImportMetaEnv { readonly DEV: boolean }\ninterface ImportMeta { readonly env: ImportMetaEnv }\n'
      );
      writeFileSync(join(dir, 'index.tsx'), emitIndex(names));

      const program = ts.createProgram([join(dir, 'index.tsx'), join(dir, 'env.d.ts')], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        // index.tsx импортирует схему из JSON — как и в целевом проекте
        // (projects/react-playground/tsconfig.app.json).
        resolveJsonModule: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        baseUrl: process.cwd(),
      });
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.file?.fileName.replace(/\\/g, '/').endsWith('index.tsx'))
        .map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);

      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Визард — единственная форма, у которой набор файлов отличается от плоской: библиотека не даёт
// компонента под `$component(Wizard)`, поэтому шим пишет приложение. Пока кодоген его не печатал,
// экспорт визарда уезжал пользователю с `reg.component('Wizard', Placeholder)` — форма собиралась,
// но шаги не рисовались и submit было некому послать (ReFormer-8vn).
describe('wizard-форма — шим вместо заглушки', () => {
  const wizardMock = synthMock(wizardSchema, { now: new Date('2026-01-01T00:00:00Z') });
  const wizardFiles = buildExampleFiles(wizardSchema, wizardMock, 'onboarding');
  const wizardSrc = (p: string) => wizardFiles.find((f) => f.path === p)!.content;

  it('в набор добавлен renderer.wizard.tsx — и только у визарда', () => {
    expect(wizardFiles.map((f) => f.path)).toContain('renderer.wizard.tsx');
    expect(files.map((f) => f.path)).not.toContain('renderer.wizard.tsx');
  });

  it('шим машинный: класс derived, перезаписывается при регенерации', () => {
    expect(wizardFiles.find((f) => f.path === 'renderer.wizard.tsx')?.cls).toBe('derived');
  });

  it('реестр берёт Wizard и Step из шима, а не из Placeholder', () => {
    const src = wizardSrc('registry.ts');
    expect(src).toContain("import { Step, Wizard } from './renderer.wizard'");
    expect(src).toContain("reg.component('Wizard', Wizard)");
    expect(src).toContain("reg.component('Step', Step)");
    expect(src).not.toContain('Placeholder');
  });

  it('шим типизирован типом формы и отдаёт оба компонента', () => {
    const src = wizardSrc('renderer.wizard.tsx');
    expect(src).toContain("import type { OnboardingForm } from './types'");
    expect(src).toContain('export function Wizard(');
    expect(src).toContain('export function Step(');
    // Рендерер отдаёт `form` пропом и не обходит детей сам — иначе шаги отрисуются дважды.
    expect(src).toContain('__selfManagedChildren = true');
  });

  // Кнопки отправки в схеме визарда нет вообще — её рисует ui-kit FormWizard и шлёт `onSubmit`.
  // С `onClick`, как у плоской формы, submit не срабатывал бы никогда, и это молчаливый отказ.
  it('submit висит на onSubmit визарда, а не на onClick кнопки', () => {
    expect(wizardSrc('renderer.behavior.ts')).toContain("onComponentEvent(wizard, 'onSubmit'");
    expect(wizardSrc('renderer.behavior.ts')).toContain("schema.node('wizard')");
    expect(byPath('renderer.behavior.ts').content).toContain("onComponentEvent(submit, 'onClick'");
  });

  // Рендерер отдаёт `form` пропом только вложенным узлам, а визард — корень схемы. Без инъекции
  // ui-kit FormWizard читает `form.submitting` у `undefined` и роняет первый же рендер — то есть
  // экспорт визарда был бы «скомпилирован, но не запускается».
  it('форма инъецируется в визард на onInit', () => {
    const src = wizardSrc('renderer.behavior.ts');
    expect(src).toContain('onInit(wizard, () => wizard.patchProps({ form }))');
    expect(src).toContain('import { hideWhen, onComponentEvent, onInit,');
    // У плоской формы onInit не нужен, а лишний импорт — ошибка под `noUnusedLocals` у пользователя.
    expect(byPath('renderer.behavior.ts').content).not.toContain('onInit');
  });

  it('набор проходит канон раскладки: шим — его опциональный файл', () => {
    const { diagnostics } = validateLayout(
      wizardFiles.map((f) => f.path),
      'renderer-json'
    );
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('README перечисляет шим среди регенерируемых файлов', () => {
    expect(wizardSrc('README.md')).toContain('`renderer.wizard.tsx`');
    expect(byPath('README.md').content).not.toContain('`renderer.wizard.tsx`');
  });
});
