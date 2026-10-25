import { validateFormSchema } from '@reformer/renderer-json/validate';
import { describe, expect, it } from 'vitest';
import { emptyRules, emptySchema } from '../../../../core/form-model';
import { builtinEntries } from '../../../../core/testing';
import type { FileToolContext } from '../../files/turn';
import type { CodeFinding, LibraryReferenceService } from '../../reference';
import { printSchemaText } from '../../model/schema-text';
import {
  createFakeFiles,
  createTestFileTurn,
  FORM_PATH,
  type FakeFiles,
} from '../../stack/testing';
import { describeComponentTool } from '../describe-component';
import { describeComponentFileTool } from './index';
import { createFileToolRegistry } from '../registry';

/** Запросы к проверке кода — так видно, с чем гейт её зовёт. */
const checkRequests: Array<{ code: string; path?: string }> = [];

// Проверка кода правил — справка по библиотеке; здесь поддельная построчная проверка, чтобы тест
// проверял политику гейта (новое — отказ, старое — не вменяется), а не корпус знаний, которого в
// CI нет.
const reference: LibraryReferenceService = {
  ask: () => Promise.resolve(null),
  checkCode(code, request) {
    checkRequests.push({ code, ...(request.path !== undefined ? { path: request.path } : {}) });
    const findings: CodeFinding[] = [];
    code.split('\n').forEach((line, index) => {
      if (line.includes('inventedOperator')) {
        findings.push({
          code: 'RF002',
          severity: 'error',
          message: 'inventedOperator is not exported by @reformer/core',
          line: index + 1,
          suggestion: 'use required',
        });
      }
      if (line.includes('deprecatedOperator')) {
        findings.push({
          code: 'RF010',
          severity: 'warning',
          message: 'deprecated',
          line: index + 1,
        });
      }
    });
    return Promise.resolve({ findings });
  },
};

/** Справка, которой проверить нечем: метод есть и отвечает `null`. */
const uncheckable: LibraryReferenceService = {
  ask: () => Promise.resolve(null),
  checkCode: () => Promise.resolve(null),
};

const catalog = builtinEntries();

const EMPTY = printSchemaText(emptySchema());
const RULES = "import { required } from '@reformer/core/validators';\n\nexport const rules = [];\n";

const registry = createFileToolRegistry();

const setup = async (
  extra: Record<string, string> = {},
  checker: LibraryReferenceService | null = reference
) => {
  const files = createFakeFiles({ [FORM_PATH]: EMPTY, ...extra });
  const turn = await createTestFileTurn(files, checker ? { reference: () => checker } : {});
  const ctx = (): FileToolContext => ({
    draft: turn.draft(),
    base: turn.base,
    rules: emptyRules(),
    catalog,
    validateForm: validateFormSchema,
    files: turn,
  });
  const call = (name: string, params: unknown) => registry.invoke(name, params, ctx());
  return { files, turn, call };
};

/** Текст файла модуля в двойнике. */
const at = (files: FakeFiles, rel: string) => files.text(`forms/loan/${rel}`);

describe('list_files', () => {
  it('файлы модуля с ролями, включая созданные в этом ходе', async () => {
    const { call } = await setup({
      'forms/loan/model/model.ts': 'export {};\n',
      'forms/loan/validation/form.ts': RULES,
      'forms/other/x.ts': 'чужой модуль',
    });
    await call('write_file', { path: 'schema/steps/a/form.schema.json', content: stepJson() });
    const listed = (await call('list_files', {})).text;
    expect(listed).toContain('schema/form.schema.json [form]');
    expect(listed).toContain('model/model.ts [derived');
    expect(listed).toContain('validation/form.ts [rules]');
    expect(listed).toContain('schema/steps/a/form.schema.json [step]');
    expect(listed).not.toContain('x.ts');
  });
});

describe('read_file', () => {
  it('строки с номерами и подсказка, откуда читать дальше', async () => {
    const long = Array.from({ length: 2000 }, (_, i) => `// line ${i + 1}`).join('\n');
    const { call } = await setup({ 'forms/loan/behavior/index.ts': long });
    const first = await call('read_file', { path: 'behavior/index.ts' });
    expect(first.text).toMatch(/^behavior\/index\.ts — 2000 lines/);
    expect(first.text).toContain('     1\t// line 1');
    expect(first.text).toMatch(/Continue: read_file offset=\d+$/);
    const next = await call('read_file', { path: 'behavior/index.ts', offset: 1999 });
    expect(next.text).toContain('  2000\t// line 2000');
  });

  it('файла нет — FILE_NOT_FOUND с похожими путями', async () => {
    const { call } = await setup({ 'forms/loan/validation/form.ts': RULES });
    const missing = await call('read_file', { path: 'validation/from.ts' });
    expect(missing.error?.code).toBe('FILE_NOT_FOUND');
    expect(missing.error?.suggestions).toContain('validation/form.ts');
  });

  it('путь за модуль — отказ, до рабочей области не доходит', async () => {
    const { call } = await setup();
    expect((await call('read_file', { path: '../other/x.ts' })).error?.code).toBe('PATH_REFUSED');
  });
});

describe('edit_file', () => {
  it('правка ложится сразу, с пометкой хода, и попадает в журнал', async () => {
    const { files, turn, call } = await setup({ 'forms/loan/validation/form.ts': RULES });
    const outcome = await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'export const rules = [];', new_string: 'export const rules = [1];' }],
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toMatch(/^Written validation\/form\.ts/);
    expect(outcome.text).toContain('export const rules = [1];');
    expect(at(files, 'validation/form.ts')).toContain('[1]');
    expect(files.writes.at(-1)?.mark).toEqual({ origin: 'agent', txId: 'turn-1' });
    expect(turn.journal.get('forms/loan/validation/form.ts')).toMatchObject({ before: RULES });
    expect(outcome.ops?.[0]).toMatchObject({ kind: 'update', ref: 'validation/form.ts' });
  });

  it('неоднозначный фрагмент — отказ, файл не тронут', async () => {
    const { files, call } = await setup({ 'forms/loan/x.ts': 'a = 1;\na = 1;\n' });
    const outcome = await call('edit_file', {
      path: 'x.ts',
      edits: [{ old_string: 'a = 1;', new_string: 'a = 2;' }],
    });
    expect(outcome.error?.code).toBe('EDIT_MISMATCH');
    expect(outcome.text).toMatch(/occurs 2 times/);
    expect(files.writes).toHaveLength(0);

    const all = await call('edit_file', {
      path: 'x.ts',
      edits: [{ old_string: 'a = 1;', new_string: 'a = 2;', replace_all: true }],
    });
    expect(all.ok).toBe(true);
    expect(at(files, 'x.ts')).toBe('a = 2;\na = 2;\n');
  });

  it('пачка — всё или ничего: вторая правка не нашлась, первая не записана', async () => {
    const { files, call } = await setup({ 'forms/loan/x.ts': 'one\ntwo\n' });
    const outcome = await call('edit_file', {
      path: 'x.ts',
      edits: [
        { old_string: 'one', new_string: 'ONE' },
        { old_string: 'three', new_string: 'THREE' },
      ],
    });
    expect(outcome.error?.code).toBe('EDIT_MISMATCH');
    expect(outcome.text).toMatch(/^Edit 2:/);
    expect(at(files, 'x.ts')).toBe('one\ntwo\n');
  });

  it('правки применяются по очереди к уже изменённому тексту', async () => {
    const { files, call } = await setup({ 'forms/loan/x.ts': 'a\n' });
    await call('edit_file', {
      path: 'x.ts',
      edits: [
        { old_string: 'a', new_string: 'b' },
        { old_string: 'b', new_string: 'c' },
      ],
    });
    expect(at(files, 'x.ts')).toBe('c\n');
  });

  it('`$&` и `$1` в замене — обычный текст', async () => {
    const { files, call } = await setup({ 'forms/loan/x.ts': 'X\n' });
    await call('edit_file', { path: 'x.ts', edits: [{ old_string: 'X', new_string: "'$&$1'" }] });
    expect(at(files, 'x.ts')).toBe("'$&$1'\n");
  });

  it('файл с CRLF правится фрагментом с LF', async () => {
    const { files, call } = await setup({ 'forms/loan/x.ts': 'a\r\nb\r\n' });
    const outcome = await call('edit_file', {
      path: 'x.ts',
      edits: [{ old_string: 'a\nb', new_string: 'a\nc' }],
    });
    expect(outcome.ok).toBe(true);
    expect(at(files, 'x.ts')).toBe('a\r\nc\r\n');
  });

  it('ломающая правка документа отвергается и НЕ пишется', async () => {
    const { files, call } = await setup();
    const outcome = await call('edit_file', {
      path: 'schema/form.schema.json',
      edits: [{ old_string: '$component(Box)', new_string: '$component(Boks)' }],
    });
    expect(outcome.error?.code).toBe('SCHEMA_INVALID');
    expect(files.writes).toHaveLength(0);
    expect(at(files, 'schema/form.schema.json')).toBe(EMPTY);
  });

  it('поле в документе — правка проходит, черновик хода обновлён', async () => {
    const { turn, call } = await setup();
    const field =
      '{ "model": "$model(email)", "component": "$component(Input)", ' +
      '"componentProps": { "label": "Email" } }';
    const outcome = await call('edit_file', {
      path: 'schema/form.schema.json',
      edits: [{ old_string: '"children": []', new_string: `"children": [${field}]` }],
    });
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(turn.draft())).toContain('$model(email)');
  });
});

describe('write_file', () => {
  it('создаёт новый файл', async () => {
    const { files, call } = await setup();
    const outcome = await call('write_file', { path: 'api/index.ts', content: 'export {};\n' });
    expect(outcome.text).toMatch(/^Created api\/index\.ts/);
    expect(outcome.ops?.[0]?.kind).toBe('add');
    expect(at(files, 'api/index.ts')).toBe('export {};\n');
  });

  it('существующий файл без чтения не заменяется', async () => {
    const { call } = await setup({ 'forms/loan/x.ts': 'old\n' });
    const blind = await call('write_file', { path: 'x.ts', content: 'new\n' });
    expect(blind.error?.code).toBe('STALE_FILE');
    await call('read_file', { path: 'x.ts' });
    expect((await call('write_file', { path: 'x.ts', content: 'new\n' })).ok).toBe(true);
  });

  it('изменённый после чтения файл не заменяется', async () => {
    const { files, call } = await setup({ 'forms/loan/x.ts': 'old\n' });
    await call('read_file', { path: 'x.ts' });
    files.put('forms/loan/x.ts', 'human edit\n');
    const outcome = await call('write_file', { path: 'x.ts', content: 'new\n' });
    expect(outcome.error?.code).toBe('STALE_FILE');
    expect(at(files, 'x.ts')).toBe('human edit\n');
  });

  it('документ формы из затравки считается прочитанным', async () => {
    const { turn, call } = await setup();
    turn.see('schema/form.schema.json', EMPTY);
    const outcome = await call('write_file', {
      path: 'schema/form.schema.json',
      content: EMPTY.replace('space-y-4', 'space-y-2'),
    });
    expect(outcome.ok).toBe(true);
  });
});

describe('гейт кода правил', () => {
  it('новый выдуманный символ — CODE_INVALID со строкой и подсказкой', async () => {
    const { files, call } = await setup({ 'forms/loan/validation/form.ts': RULES });
    const outcome = await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'export const rules = [];', new_string: 'inventedOperator();' }],
    });
    expect(outcome.error?.code).toBe('CODE_INVALID');
    expect(outcome.text).toContain('line 3: RF002');
    expect(outcome.text).toContain('use required');
    expect(at(files, 'validation/form.ts')).toBe(RULES);
  });

  it('старая находка правке не вменяется, даже если строка сдвинулась', async () => {
    const legacy = `${RULES}inventedOperator();\n`;
    const { call } = await setup({ 'forms/loan/validation/form.ts': legacy });
    const outcome = await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'import { required }', new_string: '// note\nimport { required }' }],
    });
    expect(outcome.ok).toBe(true);
  });

  it('новое предупреждение — замечание, а не отказ', async () => {
    const { call } = await setup({ 'forms/loan/validation/form.ts': RULES });
    const outcome = await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'export const rules = [];', new_string: 'deprecatedOperator();' }],
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toMatch(/Heads up: line 3: RF010/);
  });

  it('без справки — запись проходит с пометкой', async () => {
    const { call } = await setup({ 'forms/loan/validation/form.ts': RULES }, null);
    const outcome = await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'export const rules = [];', new_string: 'inventedOperator();' }],
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toMatch(/Code check unavailable/);
  });

  it('справке проверить нечем (`null`) — запись проходит с той же пометкой', async () => {
    const { call } = await setup({ 'forms/loan/validation/form.ts': RULES }, uncheckable);
    const outcome = await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'export const rules = [];', new_string: 'inventedOperator();' }],
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toMatch(/Code check unavailable/);
  });

  it('проверка получает путь файла и оба текста — после правки и до неё', async () => {
    checkRequests.length = 0;
    const { call } = await setup({ 'forms/loan/validation/form.ts': RULES });
    await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'export const rules = [];', new_string: 'export const rules = [1];' }],
    });
    expect(checkRequests.map((request) => request.path)).toEqual([
      'validation/form.ts',
      'validation/form.ts',
    ]);
    expect(checkRequests[1]?.code).toBe(RULES);
  });

  it('бросок проверки — запись отвергается и НЕ пишется', async () => {
    // Барьер, который не смог проверить, отказывает, а не пропускает.
    const broken: LibraryReferenceService = {
      ask: () => Promise.resolve(null),
      checkCode: () => Promise.reject(new Error('справка недоступна по сети')),
    };
    const { files, call } = await setup({ 'forms/loan/validation/form.ts': RULES }, broken);
    const outcome = await call('edit_file', {
      path: 'validation/form.ts',
      edits: [{ old_string: 'export const rules = [];', new_string: 'inventedOperator();' }],
    });
    expect(outcome.error?.code).toBe('TOOL_FAILED');
    expect(at(files, 'validation/form.ts')).toBe(RULES);
  });
});

describe('describe_component в режиме файлов', () => {
  it('скелет — готовый JSON узла без идентификаторов', async () => {
    const { call } = await setup();
    const outcome = await call('describe_component', { name: 'Wizard' });
    expect(outcome.text).toContain('"component": "$component(Wizard)"');
    expect(outcome.text).toContain('"component": "$component(Step)"');
    expect(outcome.text).not.toContain('$nodeId');
  });

  it('структурный экземпляр прежний: то же имя, описание и схема', () => {
    expect(describeComponentFileTool.name).toBe(describeComponentTool.name);
    expect(describeComponentFileTool.description).toBe(describeComponentTool.description);
    expect(describeComponentFileTool.inputSchema).toEqual(describeComponentTool.inputSchema);
    expect(describeComponentTool.textBudget).toBeUndefined();
  });
});

/** Файл шага с одним полем. */
function stepJson(): string {
  return JSON.stringify({
    $schema: '../../form-step.schema.json',
    node: { component: '$component(Step)', componentProps: { title: 'A' }, children: [] },
  });
}
