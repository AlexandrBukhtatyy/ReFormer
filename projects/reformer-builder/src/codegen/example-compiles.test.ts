/**
 * Экспортируемый каталог формы — не текст, а рабочий проект: собираем ВЕСЬ набор файлов во
 * временную папку внутри репозитория и прогоняем tsc с настоящими типами `@reformer/*`.
 *
 * Почему каталогом целиком, а не файлом по отдельности. Дефект, ради которого этот тест написан,
 * жил МЕЖДУ файлами: `validation.ts`, собранный из правил, экспортирует `formValidation`, а
 * `renderer.behavior.ts` импортировал `makeValidationConfig` — каждый файл по отдельности валиден,
 * вместе они не компилируются. Ни `codegen.test.ts` (вхождения подстрок), ни `emit-rules.test.ts`
 * (два файла в отрыве) этого не видели, поэтому форма с правилами уезжала пользователю в виде,
 * который у него не собирается.
 *
 * Ветки берутся все: правил нет, есть только валидация, только поведение, только видимость и все
 * сразу. Ломались именно смешанные: одно правило видимости обнуляло `validation.ts`.
 */

import { describe, expect, it } from 'vitest';
import { synthMock } from '../preview-runtime/mock-synth';
import { emptyRules, type FormRules } from '../model/rules';
import { buildExampleFiles } from './index';
import { exampleSchema } from './__fixtures__/example-schema';
import { wizardSchema } from './__fixtures__/wizard-schema';

/** Заглушка vite-типов: сгенерированная страница читает `import.meta.env`, vite/client тут нет. */
const IMPORT_META_ENV_DTS = `interface ImportMetaEnv { readonly DEV: boolean }
interface ImportMeta { readonly env: ImportMetaEnv }
`;

// Дата фиксирована: иначе `synthMock` берёт `new Date()` и вывод плавает от прогона к прогону.
const mock = synthMock(exampleSchema, { now: new Date('2026-01-01T00:00:00Z') });

/** Пути модели ниже существуют в `exampleSchema` — правило на несуществующее поле не проверяет ничего. */
const CASES: ReadonlyArray<readonly [string, FormRules]> = [
  ['без правил', emptyRules()],
  [
    'только валидация',
    {
      ...emptyRules(),
      validation: [
        { target: 'amount', rules: ['required', 'min(1000)'] },
        { target: 'loanType', rules: ['required'], when: 'Boolean(model.agree)' },
      ],
    },
  ],
  [
    'только поведение',
    {
      ...emptyRules(),
      behavior: [
        {
          kind: 'enableWhen',
          target: 'amount',
          sources: ['loanType'],
          expr: 'Boolean(model.loanType)',
        },
      ],
    },
  ],
  [
    'только видимость',
    {
      ...emptyRules(),
      render: [{ kind: 'hideWhen', selector: 'zayavka-section', condition: 'false' }],
    },
  ],
  [
    'все три вида сразу',
    {
      validation: [{ target: 'amount', rules: ['required'] }],
      behavior: [
        {
          kind: 'enableWhen',
          target: 'amount',
          sources: ['loanType'],
          expr: 'Boolean(model.loanType)',
        },
      ],
      // Все три вида render-правил на настоящих селекторах, которые проставляет
      // `assignSelectors`: секция «Заявка» и вставленная submit-кнопка.
      render: [
        {
          kind: 'hideWhen',
          selector: 'zayavka-section',
          condition: 'form.agree.value.value === true',
        },
        {
          kind: 'onEvent',
          selector: 'submit',
          event: 'onMouseEnter',
          body: "onResult?.('навели', true);",
        },
        { kind: 'patchProps', selector: 'zayavka-section', props: { title: 'Заявка на кредит' } },
      ],
    },
  ],
];

describe.each(CASES)('каталог формы — %s', (_name, rules) => {
  it('компилируется целиком настоящим tsc', async () => {
    const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const ts = (await import('typescript')).default;

    // Песочница ВНУТРИ репозитория: снаружи `@reformer/*` не резолвятся и tsc сыплет ложными
    // ошибками вместо настоящих.
    mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
    const dir = mkdtempSync(join(process.cwd(), '.tmp', 'example-compiles-'));
    try {
      const files = buildExampleFiles(exampleSchema, mock, 'loan', rules);
      for (const f of files) {
        const target = join(dir, f.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, f.content);
      }
      writeFileSync(join(dir, 'env.d.ts'), IMPORT_META_ENV_DTS);

      const entries = files
        .filter((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))
        .map((f) => join(dir, f.path));
      const program = ts.createProgram([...entries, join(dir, 'env.d.ts')], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        baseUrl: process.cwd(),
      });

      const sandbox = dir.replace(/\\/g, '/');
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.file?.fileName.replace(/\\/g, '/').startsWith(sandbox))
        .map(
          (d) =>
            `${d.file?.fileName.replace(/\\/g, '/').slice(sandbox.length + 1)} TS${d.code}: ` +
            ts.flattenDiagnosticMessageText(d.messageText, ' ')
        );

      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('правила одного вида не обнуляют файлы другого', () => {
  const src = (rules: FormRules, path: string) =>
    buildExampleFiles(exampleSchema, mock, 'loan', rules).find((f) => f.path === path)!.content;

  // Ровно тот отказ, ради которого признак стал пофайловым: одно правило видимости — и
  // `validation.ts` уезжал пустым, теряя `required`, выведенные из `componentProps.required`.
  it('видимость не стирает required, выведенные из схемы', () => {
    const rules: FormRules = {
      ...emptyRules(),
      render: [{ kind: 'hideWhen', selector: 'x', condition: 'false' }],
    };
    expect(src(rules, 'validation.ts')).toContain('required(');
    expect(src(rules, 'validation.ts')).not.toContain('Правил в intent не было');
  });

  it('правила валидации не стирают пример в form.behavior.ts', () => {
    const rules = { ...emptyRules(), validation: [{ target: 'amount', rules: ['required'] }] };
    expect(src(rules, 'form.behavior.ts')).not.toContain('Поведения в intent не было');
  });

  it('правила поведения не стирают required в validation.ts', () => {
    const rules: FormRules = {
      ...emptyRules(),
      behavior: [{ kind: 'enableWhen', target: 'amount', sources: ['loanType'], expr: 'true' }],
    };
    expect(src(rules, 'validation.ts')).toContain('required(');
  });
});

/**
 * У визарда набор файлов другой: появляется шим `renderer.wizard.tsx`, реестр берёт `Wizard`/`Step`
 * из него, а `renderer.behavior.ts` вешает submit на другое событие. Каждый файл по отдельности
 * валиден и здесь — ломается ровно связка, поэтому каталог компилируется целиком, как и выше.
 */
describe('каталог формы — визард', () => {
  it('компилируется целиком настоящим tsc', async () => {
    const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const ts = (await import('typescript')).default;

    const wizardMock = synthMock(wizardSchema, { now: new Date('2026-01-01T00:00:00Z') });

    mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
    const dir = mkdtempSync(join(process.cwd(), '.tmp', 'wizard-compiles-'));
    try {
      const files = buildExampleFiles(wizardSchema, wizardMock, 'onboarding', emptyRules());
      for (const f of files) {
        const target = join(dir, f.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, f.content);
      }
      writeFileSync(join(dir, 'env.d.ts'), IMPORT_META_ENV_DTS);

      const entries = files
        .filter((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))
        .map((f) => join(dir, f.path));
      const program = ts.createProgram([...entries, join(dir, 'env.d.ts')], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        baseUrl: process.cwd(),
      });

      const sandbox = dir.replace(/\\/g, '/');
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.file?.fileName.replace(/\\/g, '/').startsWith(sandbox))
        .map(
          (d) =>
            `${d.file?.fileName.replace(/\\/g, '/').slice(sandbox.length + 1)} TS${d.code}: ` +
            ts.flattenDiagnosticMessageText(d.messageText, ' ')
        );

      expect(errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
