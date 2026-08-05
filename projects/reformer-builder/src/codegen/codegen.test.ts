import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { synthMock } from '../preview-runtime/mock-synth';
import { buildExampleFiles, makeNames, appSnippet, emitEntry, validateExportable } from './index';

/** Представительная форма билдера: Div → Section (поля) + FormArray. */
const rawSchema = {
  version: '1.0',
  root: {
    component: '$html(div)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: '$component(Section)',
        componentProps: { title: 'Заявка' },
        children: [
          {
            value: '$model(loanType)',
            component: '$component(Select)',
            componentProps: { label: 'Тип', options: '$dataSource(LOAN_TYPES)', required: true },
          },
          {
            value: '$model(amount)',
            component: '$component(Input)',
            componentProps: { label: 'Сумма', type: 'number' },
          },
          {
            value: '$model(agree)',
            component: '$component(Checkbox)',
            componentProps: { label: 'Согласен', required: true },
          },
        ],
      },
      {
        array: '$model(items)',
        initialValue: { name: '' },
        componentProps: { title: 'Позиции', itemLabel: '$dataSource(ITEM_LABEL)' },
        item: {
          $template: {
            component: '$html(div)',
            children: [
              {
                value: '$model(name)',
                component: '$component(Input)',
                componentProps: { label: 'Название' },
              },
            ],
          },
        },
      },
    ],
  },
} as unknown as JsonFormSchema;

const mock = synthMock(rawSchema, { now: new Date('2026-01-01T00:00:00Z') });
const files = buildExampleFiles(rawSchema, mock, 'loan');
const byPath = (p: string) => files.find((f) => f.path === p)!;

describe('buildExampleFiles — набор файлов', () => {
  it('12 файлов, ожидаемые пути, нет JSON-схемы', () => {
    expect(files.map((f) => f.path).sort()).toEqual(
      [
        'api.ts',
        'data-sources.ts',
        'entry.ts',
        'form.behavior.ts',
        'index.tsx',
        'model.ts',
        'README.md',
        'registry.ts',
        'renderer.behavior.ts',
        'schema.ts',
        'types.ts',
        'validation.ts',
      ].sort()
    );
    expect(files.some((f) => f.path.endsWith('.json'))).toBe(false);
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
        'entry.ts',
        'index.tsx',
        'model.ts',
        'registry.ts',
        'schema.ts',
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

describe('schema.ts — селекторы + submit впечены', () => {
  const src = byPath('schema.ts').content;
  it('типизированный литерал JsonFormSchema', () => {
    expect(src).toContain('export const schema: JsonFormSchema =');
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

describe('emitEntry — запись реестра форм', () => {
  const n = makeNames('loan application');
  const code = emitEntry(n);

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

  it('импортирует ровно то, что генерируют другие эмиттеры', () => {
    expect(code).toContain(`import { ${n.modelFactory} } from './model';`);
    expect(code).toContain("import { createRegistry } from './registry';");
    expect(code).toContain("import { formBehavior } from './form.behavior';");
    expect(code).toContain("import { createJsonRenderBehavior } from './renderer.behavior';");
  });

  it('помечен как derived — им владеет машина', () => {
    const entry = files.find((f) => f.path === 'entry.ts');
    expect(entry?.cls).toBe('derived');
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

describe('emitEntry — сгенерированный код КОМПИЛИРУЕТСЯ', () => {
  it('entry.ts проходит tsc в связке с реальными типами пакетов', async () => {
    // Все прочие тесты проверяют вхождение подстрок — они не отличают валидный TypeScript от
    // мусора. Именно поэтому мимо них прошло несовпадение сигнатуры renderBehavior: реестр
    // третьим аргументом отдаёт валидацию, а createJsonRenderBehavior ждёт там настройки.
    const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ts = (await import('typescript')).default;

    // Песочница ВНУТРИ репозитория: снаружи @reformer/* не резолвятся, контекстный тип
    // FormEntry теряется, и tsc сыплет ложными implicit-any вместо настоящих ошибок.
    mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
    const dir = mkdtempSync(join(process.cwd(), '.tmp', 'emit-entry-'));
    try {
      const names = makeNames('loan application');
      // Соседи-заглушки: проверяем ИМЕННО entry.ts, а не весь сгенерированный набор.
      writeFileSync(join(dir, 'schema.ts'), 'export const schema = { root: {} } as never;\n');
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
      writeFileSync(join(dir, 'entry.ts'), emitEntry(names));

      const program = ts.createProgram([join(dir, 'entry.ts')], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        baseUrl: process.cwd(),
      });
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.file?.fileName.replace(/\\/g, '/').endsWith('entry.ts'))
        .map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);

      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
