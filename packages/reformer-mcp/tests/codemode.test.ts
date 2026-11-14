/**
 * Code Mode (эксперимент, `REFORMER_SURFACE=code`): объявление API из `tools/list`, инструмент
 * `run_script`, каталог в этом режиме и песочница QuickJS — по общему контракту
 * (`./sandbox-contract`; браузерная песочница проверяется им же в `*.browser.test.ts`).
 */

import { describe, expect, it } from 'vitest';
import { keepsWhole, truncateOldResults } from '../eval/agents/ollama.mjs';
import { apiDeclaration, asScriptCalls, functionName } from '../src/core/codemode/declaration';
import {
  dropEmptyEdits,
  INNER_CALLS_META,
  RUN_SCRIPT_TOOL,
  runScriptTool,
  type ScriptSandbox,
} from '../src/core/codemode/run-script';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { createQuickJsSandbox } from '../src/platform/cli/quickjs-sandbox';
import { describeSandboxContract } from './sandbox-contract';

describe('объявление API', () => {
  it('имя функции — инструмент в camelCase', () => {
    expect(functionName('form_build')).toBe('formBuild');
    expect(functionName('get_symbol_docs')).toBe('getSymbolDocs');
  });

  it('переносит описания и типы параметров дословно', () => {
    const text = apiDeclaration([
      {
        name: 'search_docs',
        description: 'Full-text search.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Words to find' },
            limit: { type: 'number' },
            kind: { type: 'string', enum: ['code', 'layout'] },
            files: { type: 'array', items: { type: 'string' } },
            intent: { anyOf: [{ type: 'object', additionalProperties: true }, { type: 'string' }] },
          },
          required: ['query'],
        },
      },
    ]);
    expect(text).toContain('declare const reformer: {');
    expect(text).toContain('Full-text search.');
    expect(text).toContain('/** Words to find */');
    expect(text).toContain('searchDocs(args: {');
    expect(text).toContain('query: string;');
    expect(text).toContain('limit?: number;');
    expect(text).toContain('kind?: "code" | "layout";');
    expect(text).toContain('files?: string[];');
    expect(text).toContain('intent?: Record<string, unknown> | string;');
    expect(text).toContain('}): Promise<string>;');
  });
});

describe('run_script', () => {
  const tools = [
    {
      name: 'choose_api',
      description: 'd',
      inputSchema: { type: 'object' as const, properties: { requirement: { type: 'string' } } },
    },
  ];
  /** Песочница-заглушка: исполняет заранее заданный сценарий над функциями. */
  const fake = (
    body: (fns: Record<string, (args: unknown) => Promise<string>>) => Promise<string[]>
  ): ScriptSandbox => ({
    async run(_code, functions) {
      try {
        return { logs: await body(functions) };
      } catch (error) {
        return { logs: [], error: String((error as Error).message) };
      }
    },
  });

  it('вызывает инструменты каталога и пишет вложенные вызовы в _meta', async () => {
    const result = await runScriptTool(
      { code: 'x' },
      tools,
      async (name, args) => ({
        content: [{ type: 'text', text: `${name}:${JSON.stringify(args)}` }],
      }),
      fake(async (fns) => [await fns.chooseApi!({ requirement: 'r' })])
    );
    expect(result.content[0]).toEqual({ type: 'text', text: 'choose_api:{"requirement":"r"}' });
    expect(result.isError).toBeUndefined();
    expect(
      (result._meta?.[INNER_CALLS_META] as Array<{ name: string; ok: boolean }>)[0]
    ).toMatchObject({
      name: 'choose_api',
      ok: true,
    });
  });

  it('ошибка инструмента — исключение с текстом ответа', async () => {
    const result = await runScriptTool(
      { code: 'x' },
      tools,
      async () => ({ content: [{ type: 'text', text: '✗ nope' }], isError: true }),
      fake(async (fns) => [await fns.chooseApi!({})])
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ text: '✗ script error: ✗ nope' });
  });

  it('пустой код — неверный вызов', async () => {
    const result = await runScriptTool(
      {},
      tools,
      async () => ({ content: [] }),
      fake(async () => [])
    );
    expect(result.isError).toBe(true);
  });
});

describe('каталог в режиме Code Mode', () => {
  const sandbox = createQuickJsSandbox();
  const catalog = createToolCatalog(cliKnowledge, { profile: 'node', codeMode: sandbox });
  const plain = createToolCatalog(cliKnowledge, { profile: 'node' });

  it('единственный инструмент — run_script, в описании функции всех инструментов', () => {
    const listed = catalog.list();
    expect(listed.map((tool) => tool.name)).toEqual([RUN_SCRIPT_TOOL]);
    for (const tool of plain.list()) {
      expect(listed[0]!.description).toContain(`${functionName(tool.name)}(`);
      expect(listed[0]!.description).toContain(tool.description.split('\n')[0]!);
    }
  });

  it('прямой вызов инструмента обычного режима — неизвестное имя', async () => {
    await expect(catalog.call('choose_api', { requirement: 'x' })).rejects.toThrow(/Unknown tool/);
  });

  it('скрипт получает тот же ответ, что прямой вызов', async () => {
    const direct = await plain.call('choose_api', { requirement: 'total = price * quantity' });
    const viaScript = await catalog.call('run_script', {
      code: 'console.log(await reformer.chooseApi({ requirement: "total = price * quantity" }))',
    });
    expect(viaScript.content[0]).toEqual(direct.content[0]);
  });
});

describeSandboxContract('QuickJS', () =>
  createQuickJsSandbox({ timeoutMs: 3000, cpuSliceMs: 500 })
);

describe('стенд Ollama: что держится целиком', () => {
  it('скрипт со сборкой — как ответ form_build, справочный скрипт — нет', () => {
    expect(keepsWhole('form_build', {})).toBe(true);
    expect(
      keepsWhole('run_script', { code: 'console.log(await reformer.formBuild({ dir: "form" }))' })
    ).toBe(true);
    expect(keepsWhole('run_script', { code: 'await reformer.searchDocs({ query: "x" })' })).toBe(
      false
    );
  });

  it('связка с guided: план и правки со сборкой держатся целиком', () => {
    expect(keepsWhole('run_script', { code: 'console.log(await reformer.formStart({}))' })).toBe(
      true
    );
    expect(keepsWhole('run_script', { code: 'console.log(await reformer.formEdit({}))' })).toBe(
      true
    );
  });

  it('усечение пропускает отмеченные ответы', () => {
    const long = 'x'.repeat(5000);
    const keptMessage = { role: 'tool', tool_name: 'run_script', content: long };
    const messages = [
      keptMessage,
      { role: 'tool', tool_name: 'run_script', content: long },
      ...Array.from({ length: 4 }, () => ({
        role: 'tool',
        tool_name: 'search_docs',
        content: 'y',
      })),
    ];
    const kept = new WeakSet([keptMessage]);
    expect(truncateOldResults(messages, kept)).toBe(1);
    expect(keptMessage.content).toHaveLength(5000);
  });
});

describe('строки вызовов кодом скрипта', () => {
  it('вызов с объектом переписан, упоминание без объекта и строка сборки — нет', () => {
    const text = [
      'Change the form ONLY with form_edit: it builds.',
      '✓ form_build: written 8, unchanged 0.',
      'form_edit {"dir":"form","edits":[{"op":"add_field","name":"a"}]}',
      'The task has no validation? form_status {"dir":"form","skip":"validation"}',
    ].join('\n');
    expect(asScriptCalls(text, ['form_edit', 'form_status', 'form_build']).split('\n')).toEqual([
      'Change the form ONLY with form_edit: it builds.',
      '✓ form_build: written 8, unchanged 0.',
      'await reformer.formEdit({"dir":"form","edits":[{"op":"add_field","name":"a"}]})',
      'The task has no validation? await reformer.formStatus({"dir":"form","skip":"validation"})',
    ]);
  });
});

describe('пустой второй edits в вызове formEdit', () => {
  it('выбрасывается, если в том же вызове есть другой edits; одиночный пустой — нет', () => {
    const code = [
      'console.log(await reformer.formEdit({ "dir": "form", "edits": [{ "op": "add_rule", "field": "c" }], "edits": [] }))',
      'console.log(await reformer.formEdit({ dir: "form", edits: [] }))',
    ].join('\n');
    const { code: fixed, dropped } = dropEmptyEdits(code);
    expect(dropped).toBe(1);
    expect(fixed.split('\n')).toEqual([
      'console.log(await reformer.formEdit({ "dir": "form", "edits": [{ "op": "add_rule", "field": "c" }] }))',
      'console.log(await reformer.formEdit({ dir: "form", edits: [] }))',
    ]);
  });
});
