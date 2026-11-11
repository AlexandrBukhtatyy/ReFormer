/**
 * `plan_form` профиля node (7.0): черновик `form.intent.json` пишется на диск, ответ — сводка.
 *
 * Прежде intent возвращался текстом, и большой JSON модель печатала в файл заново; по свободному
 * описанию выходил пустой intent с ✓ (аудит 2026-11, A1/A3). Здесь проверено, что черновик лежит на
 * диске, читается сервером без проблем, собирается `form_build` и никогда не затирает файл агента.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readIntent } from '../src/core/generate/form-intent';
import { formatIntentJson } from '../src/core/generate/intent-format';
import { intentGrammar } from '../src/core/generate/intent-grammar';
import type { Knowledge } from '../src/core/knowledge';
import { formBuildTool, INTENT_FILE } from '../src/core/tools/form-build';
import { planFormTool } from '../src/core/tools/plan-form';
import { UNAVAILABLE_FORM_WORKSPACE } from '../src/core/workspace/form-workspace';
import { createCliFormWorkspace, TYPECHECK_ROOT_ENV } from '../src/platform/cli/form-workspace';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { CATALOGS } from './support/catalogs';

const repoRoot = resolve(__dirname, '../../..');
const specPath = resolve(__dirname, 'fixtures/spec-loan-request.md');
const SLOW = 120_000;

let project: string;
let knowledge: Knowledge;
const previousRoot = process.env[TYPECHECK_ROOT_ENV];

const textOf = (result: { content: Array<{ text: string }> }) => result.content[0].text;
const draftPath = () => join(project, 'form', INTENT_FILE);

beforeAll(() => {
  process.env[TYPECHECK_ROOT_ENV] = repoRoot;
});

afterAll(() => {
  if (previousRoot === undefined) delete process.env[TYPECHECK_ROOT_ENV];
  else process.env[TYPECHECK_ROOT_ENV] = previousRoot;
});

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'plan-form-'));
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ name: 'consumer', dependencies: { '@reformer/core': '*' } })
  );
  knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(project) };
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('plan_form: черновик на диск', () => {
  it('пишет form.intent.json и отвечает сводкой без JSON', async () => {
    const result = await planFormTool({ specPath, target: 'renderer-react' }, knowledge);
    const text = textOf(result);
    expect(result.isError).not.toBe(true);
    expect(text).toMatch(/^✓ plan_form: drafted form\/form\.intent\.json from /);
    expect(text).toContain('Next: edit form/form.intent.json');
    expect(text).not.toContain('```json');
    expect(text.length).toBeLessThan(3000);

    const draft = JSON.parse(readFileSync(draftPath(), 'utf-8'));
    expect(draft.target).toBe('renderer-react');
    expect(draft.fields.length).toBeGreaterThan(0);
    // Заметки разбора — в ответе, а не в файле: там они печатались бы каждой сборкой.
    expect(draft.warnings).toBeUndefined();
    expect(readIntent(draft, { uiKit: CATALOGS.uiKit }).problems).toEqual([]);
  });

  it('запись поля — одна строка файла', async () => {
    await planFormTool({ specPath }, knowledge);
    const source = readFileSync(draftPath(), 'utf-8');
    const draft = JSON.parse(source);
    for (const field of draft.fields) {
      expect(source).toContain(`    ${JSON.stringify(field)}`);
    }
  });

  it(
    'черновик собирается form_build без правок',
    async () => {
      await planFormTool({ specPath, target: 'renderer-react' }, knowledge);
      const text = textOf(await formBuildTool({}, knowledge));
      expect(text).toContain('✓ form_build');
    },
    SLOW
  );

  it('существующий файл не перезаписывается', async () => {
    mkdirSync(join(project, 'form'), { recursive: true });
    writeFileSync(draftPath(), '{"formName":"mine"}');
    const result = await planFormTool({ specPath }, knowledge);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('already exists and is never overwritten');
    expect(readFileSync(draftPath(), 'utf-8')).toBe('{"formName":"mine"}');
  });

  it('свой каталог формы', async () => {
    const text = textOf(await planFormTool({ specPath, dir: 'src/forms/loan' }, knowledge));
    expect(text).toContain('drafted src/forms/loan/form.intent.json');
    expect(existsSync(join(project, 'src/forms/loan', INTENT_FILE))).toBe(true);
  });
});

describe('plan_form: отказы', () => {
  it('description вместо спеки — отказ с путём через грамматику', async () => {
    const result = await planFormTool({ description: 'Форма: имя, email' }, knowledge);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('form_build {"grammar":"base"}');
    expect(existsSync(draftPath())).toBe(false);
  });

  it('без specPath — отказ', async () => {
    const result = await planFormTool({}, knowledge);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('"specPath" is required');
  });

  it('несуществующая спека — отказ с путём, ничего не записано', async () => {
    const missing = resolve(__dirname, 'no-such-spec.md');
    const result = await planFormTool({ specPath: missing }, knowledge);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('spec not found');
    expect(textOf(result)).toContain('no-such-spec.md');
    expect(existsSync(join(project, 'form'))).toBe(false);
  });
});

describe('корень монорепо', () => {
  beforeEach(() => {
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({
        name: 'mono',
        private: true,
        workspaces: ['apps/*'],
        devDependencies: { typescript: '*' },
      })
    );
  });

  it('без dir — отказ: форма легла бы мимо приложений', async () => {
    const plan = await planFormTool({ specPath }, knowledge);
    expect(plan.isError).toBe(true);
    expect(textOf(plan)).toContain('monorepo root');
    const build = await formBuildTool({}, knowledge);
    expect(build.isError).toBe(true);
    expect(textOf(build)).toContain('monorepo root');
    expect(existsSync(join(project, 'form'))).toBe(false);
  });

  it('с dir — работает', async () => {
    const text = textOf(await planFormTool({ specPath, dir: 'apps/web/src/loan' }, knowledge));
    expect(text).toContain('drafted apps/web/src/loan/form.intent.json');
  });
});

describe('form_build {grammar}', () => {
  const noDisk = (): Knowledge => ({ ...cliKnowledge(), forms: UNAVAILABLE_FORM_WORKSPACE });

  it('грамматика без проекта и без диска', async () => {
    const result = await formBuildTool({ grammar: 'base' }, noDisk());
    expect(result.isError).not.toBe(true);
    expect(textOf(result)).toBe(intentGrammar(CATALOGS));
  });

  it('true — база, секция — только она, all — всё', async () => {
    expect(textOf(await formBuildTool({ grammar: true }, noDisk()))).toBe(intentGrammar(CATALOGS));
    expect(textOf(await formBuildTool({ grammar: 'arrays' }, noDisk()))).toBe(
      intentGrammar(CATALOGS, { sections: ['arrays'] })
    );
    expect(textOf(await formBuildTool({ grammar: 'all' }, noDisk()))).toBe(
      intentGrammar(CATALOGS, { sections: 'all' })
    );
  });

  it('грамматика при существующем intent — не сборка', async () => {
    mkdirSync(join(project, 'form'), { recursive: true });
    writeFileSync(draftPath(), '{ not json');
    const text = textOf(await formBuildTool({ grammar: 'wizard' }, knowledge));
    expect(text.startsWith('## wizard')).toBe(true);
  });

  it('незнакомая секция — отказ со списком', async () => {
    const result = await formBuildTool({ grammar: 'steps' }, noDisk());
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/unknown grammar section "steps".*arrays, wizard/);
  });
});

describe('formatIntentJson', () => {
  it('обычный JSON: разбирается в тот же объект', () => {
    const intent = {
      formName: 'X',
      fields: [{ name: 'a', type: 'string' }],
      layoutRoot: { kind: 'container', component: 'Box', children: ['a'] },
      validation: [],
    };
    expect(JSON.parse(formatIntentJson(intent))).toEqual(intent);
  });

  it('длинная раскладка — по узлу на строку', () => {
    const children = Array.from({ length: 12 }, (_, i) => `field${i}`);
    const text = formatIntentJson({
      layoutRoot: {
        kind: 'container',
        component: 'Box',
        children: [{ kind: 'step', title: 'One', children }],
      },
    });
    expect(text).toMatch(/\n {6,}"field0",\n {6,}"field1",\n/);
  });
});
