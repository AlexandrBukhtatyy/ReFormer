/**
 * Судья intent: один вердикт для `form_build`, `validate_form kind="bundle"` и билдера (аудит 2026-11,
 * B2, B4, B5; план — фаза 3).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { NO_CORE_OPERATORS } from '../src/core/generate/core-operators';
import { GRAMMAR_EXAMPLE } from '../src/core/generate/intent-grammar';
import { judgeIntent, rankWarnings } from '../src/core/generate/judge';
import type { Knowledge } from '../src/core/knowledge';
import { formBuildTool } from '../src/core/tools/form-build';
import { validateFormTool } from '../src/core/tools/validate-form';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { createCliFormWorkspace, TYPECHECK_ROOT_ENV } from '../src/platform/cli/form-workspace';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const small = (extra: Record<string, unknown> = {}) => ({
  formName: 'Sign-up',
  target: 'renderer-react',
  fields: [{ name: 'email', type: 'string', component: 'Input', label: 'Email', initialValue: '' }],
  layoutRoot: { kind: 'container', component: 'Box', children: ['email'] },
  ...extra,
});

const codes = (raw: unknown, options = {}) =>
  judgeIntent(raw, CATALOGS, options).errors.map((error) => error.code);

describe('judgeIntent', () => {
  it('образец грамматики проходит; модуль собран', () => {
    const verdict = judgeIntent(clone(GRAMMAR_EXAMPLE), CATALOGS);
    expect(verdict.errors).toEqual([]);
    expect(verdict.ok).toBe(true);
    expect(verdict.bundle?.files.map((file) => file.path)).toContain('form.schema.ts');
  });

  it('недочитанный intent дальше не судится: только проблемы чтения', () => {
    expect(codes(small({ fields: [{ name: 'email', lable: 'x' }] }))).toEqual(['unknown-key']);
  });

  it('компонент не из кита — ошибка с ближайшим именем (B4)', () => {
    const verdict = judgeIntent(
      small({ fields: [{ name: 'email', type: 'string', component: 'Inptu', label: 'Email' }] }),
      CATALOGS
    );
    expect(verdict.errors).toEqual([
      expect.objectContaining({
        code: 'unknown-component',
        message: expect.stringContaining('did you mean `Input`?'),
      }),
    ]);
  });

  it('шаги вперемешку с полями — C13', () => {
    const raw = small({
      layoutRoot: {
        kind: 'container',
        component: 'FormWizard',
        children: [{ kind: 'step', title: 'One', children: ['email'] }, 'email'],
      },
    });
    expect(codes(raw)).toContain('C13');
  });

  it('шаг внутри шага — C13', () => {
    const raw = small({
      layoutRoot: {
        kind: 'container',
        children: [
          {
            kind: 'step',
            title: 'Outer',
            children: [{ kind: 'step', title: 'Inner', children: ['email'] }],
          },
        ],
      },
    });
    expect(codes(raw)).toContain('C13');
  });

  it('объявленный и никем не использованный справочник — C9 ошибкой', () => {
    expect(codes(small({ dataSources: [{ name: 'UNUSED', values: [] }] }))).toEqual(['C9']);
  });

  it('поле вне раскладки — unplaced, без дубля C9', () => {
    const raw = small({
      fields: [
        { name: 'email', type: 'string', component: 'Input', label: 'Email' },
        { name: 'phone', type: 'string', component: 'Input', label: 'Phone' },
      ],
    });
    expect(codes(raw)).toEqual(['unplaced']);
  });

  it('видимость на core — not-on-target; в документе билдера — нет', () => {
    const raw = small({
      target: 'core',
      visibility: [{ selector: 'email', condition: 'false' }],
    });
    expect(codes(raw)).toContain('not-on-target');
    expect(codes(raw, { forDocument: true })).not.toContain('not-on-target');
  });

  it('без индекса ядра — ошибка окружения; validate_form её не требует', () => {
    const blind = { ...CATALOGS, core: NO_CORE_OPERATORS };
    expect(judgeIntent(small(), blind).errors.map((e) => e.code)).toEqual(['environment']);
    expect(judgeIntent(small(), blind, { requireEnvironment: false }).ok).toBe(true);
  });
});

describe('порядок предупреждений', () => {
  it('меняющие смысл — первыми, порядок внутри группы сохраняется', () => {
    const ranked = rankWarnings([
      { code: 'keys-renamed', message: 'a' },
      { code: 'component-default', message: 'b' },
      { code: 'list-as-map', message: 'c' },
      { code: 'unnamed-dropped', message: 'd' },
    ]);
    expect(ranked.map((w) => w.message)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('судья отдаёт предупреждения уже по порядку', () => {
    const verdict = judgeIntent(
      {
        formName: 'Order',
        fields: { email: { component: 'Input', label: 'Email' } },
        layoutRoot: { kind: 'container', children: ['email'] },
      },
      CATALOGS
    );
    const codes = verdict.warnings.map((w) => w.code);
    expect(codes.indexOf('type-default')).toBeLessThan(codes.indexOf('list-as-map'));
  });
});

describe('validate_form kind="bundle" — тот же судья', () => {
  const k = cliKnowledge();
  const bundle = async (args: Record<string, unknown>) =>
    (await validateFormTool({ kind: 'bundle', ...args }, k)).content[0].text;

  it('поля словарём читаются, а не роняют вызов -32603 (B2)', async () => {
    const text = await bundle({
      intent: {
        formName: 'Map',
        fields: { email: { type: 'string', component: 'Input', label: 'Email' } },
        layoutRoot: { kind: 'container', children: ['email'] },
      },
    });
    expect(text).toContain('# validate_form (bundle)');
    expect(text).not.toMatch(/items\.filter is not a function/);
  });

  it('intent строкой JSON — тоже intent', async () => {
    const text = await bundle({ intent: JSON.stringify(small()) });
    expect(text).toMatch(/✅/);
  });

  it('незнакомый ключ — RF014 с местом и подсказкой', async () => {
    const text = await bundle({ intent: small({ fields: [{ name: 'email', lable: 'x' }] }) });
    expect(text).toContain('**RF014**');
    expect(text).toContain('fields[0].lable');
    expect(text).toContain('did you mean `label`?');
  });
});

describe('один вердикт: form_build и validate_form', () => {
  const project = mkdtempSync(join(tmpdir(), 'judge-'));
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ name: 'judge-probe', private: true, dependencies: { '@reformer/core': '*' } })
  );
  const previousRoot = process.env[TYPECHECK_ROOT_ENV];
  // Типы модуля проверяются компилятором монорепо, как в тестах form_build.
  beforeAll(() => {
    process.env[TYPECHECK_ROOT_ENV] = repoRoot;
  });
  afterAll(() => {
    if (previousRoot === undefined) delete process.env[TYPECHECK_ROOT_ENV];
    else process.env[TYPECHECK_ROOT_ENV] = previousRoot;
    rmSync(project, { recursive: true, force: true });
  });
  const k: Knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(project) };

  /** Коды ошибок из ответа form_build: строки «- <код>[ at …]: …». */
  const buildCodes = async (intent: unknown): Promise<string[]> => {
    const dir = join(project, 'form');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'form.intent.json'), JSON.stringify(intent));
    const text = (await formBuildTool({ dir: 'form' }, k)).content[0].text;
    if (text.startsWith('✓')) return [];
    const found = [...text.matchAll(/^- ([\w-]+)(?: at |:)/gm)].map((m) => m[1]);
    // Отказ, в котором нет ни одной находки судьи, — не «ошибок нет», а сбой самого теста.
    return found.length > 0 ? found : [`unparsed: ${text.split('\n')[0]}`];
  };
  /** Коды ошибок из ответа validate_form: «- **RFxxx** TITLE … — <код>: …» в разделе Errors. */
  const validateCodes = async (intent: unknown): Promise<string[]> => {
    const text = (await validateFormTool({ kind: 'bundle', intent }, k)).content[0].text;
    const errors = text.split('## Warnings')[0];
    return [...errors.matchAll(/^- \*\*RF\d+\*\* \w+(?: at \S+)? — ([\w-]+):/gm)].map((m) => m[1]);
  };

  const cases: Array<[string, unknown]> = [
    ['образец', clone(GRAMMAR_EXAMPLE)],
    ['незнакомый ключ', small({ fields: [{ name: 'email', lable: 'x' }] })],
    ['неизвестный компонент', small({ fields: [{ name: 'email', component: 'Inptu' }] })],
    ['справочник без поля', small({ dataSources: [{ name: 'UNUSED', values: [] }] })],
    [
      'видимость на core',
      small({ target: 'core', visibility: [{ selector: 'email', condition: 'false' }] }),
    ],
    [
      'смешанные шаги',
      small({
        layoutRoot: {
          kind: 'container',
          children: [{ kind: 'step', title: 'One', children: ['email'] }, 'email'],
        },
      }),
    ],
  ];

  it.each(cases)(
    '%s',
    async (_name, intent) => {
      const [built, validated] = [await buildCodes(intent), await validateCodes(intent)];
      expect(validated).toEqual(built);
    },
    120_000
  );
});
