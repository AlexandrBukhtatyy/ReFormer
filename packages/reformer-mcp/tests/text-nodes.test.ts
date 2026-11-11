/**
 * Текстовые узлы intent (ReFormer-11oe.16): заголовок, абзац, подпись кнопки — страница, а не только
 * форма. Строка в `children` — ссылка на поле, поэтому текст — запись `{ "text": … }`. Без неё модель
 * писала текст кнопок мимо сборки, правкой сгенерированной схемы (прогон sonnet L5-registration,
 * 2026-11-11).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import { buildFormSchemaJson, buildFormSchemaTs } from '../src/core/generate/schema-emit';
import { intentGrammar } from '../src/core/generate/intent-grammar';
import { judgeIntent } from '../src/core/generate/judge';
import { readIntent, type IntentReading } from '../src/core/generate/form-intent';
import { formBuildTool, INTENT_FILE } from '../src/core/tools/form-build';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { createCliFormWorkspace, TYPECHECK_ROOT_ENV } from '../src/platform/cli/form-workspace';

const read = (raw: unknown): IntentReading =>
  readIntent(raw, { uiKit: CATALOGS.uiKit, uiKitProps: CATALOGS.uiKitProps });

/** Страница входа: заголовок, абзац, поле и кнопка с подписью. */
const page = (target = 'renderer-react', children: unknown[] = []) => ({
  formName: 'Вход',
  target,
  fields: [{ name: 'login', type: 'string', component: 'Input', label: 'Логин' }],
  layoutRoot: {
    kind: 'container',
    component: 'Box',
    children: [
      { kind: 'container', component: 'TypographyH1', children: [{ text: 'Вход в кабинет' }] },
      {
        kind: 'container',
        component: 'TypographyP',
        children: [{ kind: 'text', text: 'Введите логин.' }],
      },
      'login',
      {
        kind: 'container',
        component: 'Button',
        componentProps: { type: 'submit' },
        children: [{ text: 'Войти' }],
      },
      ...children,
    ],
  },
});

describe('чтение текстового узла', () => {
  it('{ text } и { kind: "text", text } — текст; строка — по-прежнему поле', () => {
    const { intent, problems } = read(page());
    expect(problems).toEqual([]);
    const [heading, paragraph, field, button] = (
      intent.layoutRoot as { children: Array<{ kind: string; children?: unknown[] }> }
    ).children;
    expect(heading.children).toEqual([{ kind: 'text', text: 'Вход в кабинет' }]);
    expect(paragraph.children).toEqual([{ kind: 'text', text: 'Введите логин.' }]);
    expect(field).toEqual({ kind: 'field', ref: 'login' });
    expect(button.children).toEqual([{ kind: 'text', text: 'Войти' }]);
  });

  it('число — текстом, синоним content — тоже', () => {
    const { intent } = read(
      page('renderer-react', [{ text: 2026 }, { kind: 'text', content: 'год' }])
    );
    const children = (intent.layoutRoot as { children: unknown[] }).children;
    expect(children.slice(-2)).toEqual([
      { kind: 'text', text: '2026' },
      { kind: 'text', text: 'год' },
    ]);
  });

  it('пустой текст, селектор у текста и незнакомый ключ — проблемы с образцом', () => {
    const { problems } = read(
      page('renderer-react', [
        { text: '' },
        { text: 'Итого', selector: 'total' },
        { text: 'Привет', bold: true },
      ])
    );
    expect(problems.map((problem) => [problem.code, problem.at])).toEqual([
      ['missing-key', 'layoutRoot.children[4].text'],
      ['invalid-value', 'layoutRoot.children[5].selector'],
      ['unknown-key', 'layoutRoot.children[6].bold'],
    ]);
    expect(problems[1].expected).toContain('"selector": "total"');
  });

  it('текст корнем раскладки или части — проблема: его некуда поставить', () => {
    const { problems } = read({
      ...page(),
      layoutRoot: { text: 'Только текст' },
      parts: { note: { text: 'Подсказка' } },
    });
    expect(problems.map((problem) => problem.at)).toEqual(['layoutRoot', 'parts.note']);
    expect(problems[0].expected).toContain('"children": [{ "text": "Только текст" }]');
  });
});

describe('печать: текст — часть детей узла', () => {
  it('документ renderer-json: строки в children, документ проходит мета-схему', async () => {
    const document = JSON.parse(buildFormSchemaJson(read(page('renderer-json')).intent));
    const [heading, , , button] = document.root.children;
    expect(heading).toEqual({
      component: '$component(TypographyH1)',
      children: ['Вход в кабинет'],
    });
    expect(button.children).toEqual(['Войти']);
    const { validateFormSchema } = await import('@reformer/renderer-json/validate');
    expect(validateFormSchema(document).errors).toEqual([]);
  });

  it('схема renderer-react: текст строкой среди детей', () => {
    const { content } = buildFormSchemaTs(read(page()).intent, CATALOGS.uiKit);
    expect(content).toMatch(/children: \[\s*'Вход в кабинет'\s*\]/);
    expect(content).toMatch(/children: \[\s*'Войти'\s*\]/);
  });
});

describe('судья', () => {
  it('на core текст рисует JSX агента — предупреждение называет тексты', () => {
    const core = judgeIntent(page('core'), CATALOGS);
    expect(core.errors).toEqual([]);
    expect(core.warnings.map((warning) => warning.message)).toContainEqual(
      expect.stringContaining(
        'texts in the layout (3: «Вход в кабинет», «Введите логин.», «Войти»)'
      )
    );
    const react = judgeIntent(page(), CATALOGS);
    expect(react.warnings.map((warning) => warning.message).join('\n')).not.toContain(
      'texts in the layout'
    );
  });

  it('страница без полей — не «пустая оболочка», если на ней есть текст', () => {
    const blank = { ...page(), fields: [] };
    blank.layoutRoot.children = blank.layoutRoot.children.filter((child) => child !== 'login');
    expect(read(blank).notices.map((notice) => notice.code)).not.toContain('no-fields');
    const empty = read({
      formName: 'Пусто',
      fields: [],
      layoutRoot: { kind: 'container', component: 'Box', children: [] },
    });
    expect(empty.notices.map((notice) => notice.code)).toContain('no-fields');
  });
});

describe('грамматика', () => {
  it('база и документ называют запись текста', () => {
    for (const grammar of [
      intentGrammar(CATALOGS),
      intentGrammar(CATALOGS, { profile: 'document' }),
    ]) {
      expect(grammar).toContain('- Text: {"text":"Sign in"} among children');
    }
  });
});

describe('form_build: страница с текстом на каждом стеке', () => {
  const repoRoot = resolve(__dirname, '../../..');
  const previousRoot = process.env[TYPECHECK_ROOT_ENV];
  let project: string;

  beforeEach(() => {
    process.env[TYPECHECK_ROOT_ENV] = repoRoot;
    project = mkdtempSync(join(tmpdir(), 'text-nodes-'));
    writeFileSync(
      join(project, 'package.json'),
      '{"name":"p","dependencies":{"@reformer/core":"*"}}'
    );
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env[TYPECHECK_ROOT_ENV];
    else process.env[TYPECHECK_ROOT_ENV] = previousRoot;
  });

  it('собирается и проходит проверку типов', async () => {
    const knowledge = { ...cliKnowledge(), forms: createCliFormWorkspace(project) };
    for (const target of ['renderer-react', 'renderer-json', 'core']) {
      const dir = join(project, target);
      mkdirSync(dir);
      writeFileSync(join(dir, INTENT_FILE), JSON.stringify(page(target)));
      const result = await formBuildTool({ dir: target }, knowledge);
      const text = result.content[0].text;
      expect(text, target).toContain('✓ form_build');
      expect(text, target).toContain('Types checked, no errors.');
      const schema = ['form.schema.json', 'form.schema.ts']
        .map((file) => join(dir, file))
        .find((file) => existsSync(file));
      expect(readFileSync(schema!, 'utf-8'), target).toContain('Войти');
    }
  }, 120_000);
});
