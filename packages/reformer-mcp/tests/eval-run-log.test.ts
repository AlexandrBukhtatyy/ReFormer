/**
 * Журнал прогона стенда: полная трасса сервера, общий ключ вызова и диалог прогона
 * (`npm run mcp:log`, ReFormer-qo9b.37). Журнал — измерительный прибор: потерянный ответ или вызов,
 * приклеенный не к той строке трассы, читаются как поведение модели.
 */

import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { argumentsDigest as evalDigest } from '../eval/lib/digest.mjs';
import { readRun, renderRun } from '../eval/lib/run-log.mjs';
import type { ReformerServerCall } from '../src/core/server/mount.js';
import {
  argumentsDigest,
  createTraceSink,
  isTraceFull,
  resultText,
} from '../src/platform/cli/trace-sink.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'run-log-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const BATCH = '20261111T120000Z-test';
const SYSTEM = 'Ты собираешь формы ReFormer через form_build.';
const PROMPT = '# Задание\n\nСделай форму по `spec.md`.';
const GRAMMAR_ARGS = { grammar: 'base' };
const BUILD_ARGS = { dir: 'form' };
const GRAMMAR = 'Грамматика intent: поля, правила, поведение.';
const BUILT = '✓ form_build: written 9, unchanged 0.';
const FAILED = '✗ form_build: 2 ошибки в form.intent.json';

interface TraceLine {
  readonly [key: string]: unknown;
}

/** Шаг диалога `readRun` — то, что читают проверки. */
interface DialogStep {
  readonly calls: readonly { readonly name: string }[];
}

const readLines = (file: string): TraceLine[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as TraceLine);

function tool(name: string, args: unknown, text: string, isError = false): ReformerServerCall {
  return {
    kind: 'tool',
    name,
    arguments: args,
    resultChars: text.length,
    isError,
    protocolError: null,
    durationMs: 12.4,
    result: { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) },
  };
}

function resource(uri: string, text: string): ReformerServerCall {
  return {
    kind: 'resource',
    name: uri,
    arguments: undefined,
    resultChars: text.length,
    isError: false,
    protocolError: null,
    durationMs: 3,
    result: { contents: [{ uri, mimeType: 'text/markdown', text }] },
  };
}

interface RunFiles {
  readonly prompt?: string;
  readonly transcript?: readonly unknown[];
  /** Вызовы, пришедшие на сервер, — их пишет настоящая трасса. */
  readonly calls?: readonly ReformerServerCall[];
  /** Полная трасса (`REFORMER_TRACE_FULL`); по умолчанию — да, как у стенда сценариев. */
  readonly full?: boolean;
  readonly finalText?: string;
  readonly record?: Record<string, unknown>;
}

/** Каталог прогона, как его оставляет раннер: `<батч>/<прогон>/` и `records.jsonl` батча. */
function writeRun(slug: string, files: RunFiles): string {
  const batch = path.join(root, BATCH);
  const run = path.join(batch, slug);
  mkdirSync(run, { recursive: true });
  if (files.prompt !== undefined) writeFileSync(path.join(run, 'prompt.md'), files.prompt);
  if (files.transcript !== undefined) {
    const lines = files.transcript.map((entry) => `${JSON.stringify(entry)}\n`).join('');
    writeFileSync(path.join(run, 'transcript.jsonl'), lines);
  }
  const sink = createTraceSink(path.join(run, 'server-trace.jsonl'), { full: files.full ?? true });
  for (const call of files.calls ?? []) sink?.(call);
  if (files.finalText !== undefined) writeFileSync(path.join(run, 'final.txt'), files.finalText);
  if (files.record !== undefined) {
    appendFileSync(path.join(batch, 'records.jsonl'), `${JSON.stringify(files.record)}\n`);
  }
  return run;
}

describe('трасса сервера', () => {
  it('отпечаток аргументов у стенда тот же, что у сервера', () => {
    const samples = [
      undefined,
      null,
      {},
      BUILD_ARGS,
      { grammar: 'base', profile: 'document' },
      { label: 'Сумма «кредита»', nested: { list: [1, 2, { empty: null }] } },
      ['x', 1, true],
    ];
    for (const value of samples) expect(evalDigest(value)).toBe(argumentsDigest(value));
    expect(argumentsDigest(BUILD_ARGS)).toMatch(/^[0-9a-f]{16}$/);
    // Порядок ключей входит в отпечаток: агент и сервер видят один и тот же JSON.
    expect(argumentsDigest({ a: 1, b: 2 })).not.toBe(argumentsDigest({ b: 2, a: 1 }));
  });

  it('полный режим включают 1, true и yes', () => {
    for (const value of ['1', 'true', 'TRUE', 'yes', ' 1 ']) expect(isTraceFull(value)).toBe(true);
    for (const value of [undefined, '', '0', 'false', 'no', 'full']) {
      expect(isTraceFull(value)).toBe(false);
    }
  });

  it('текст ответа — блоки инструмента или ресурса через перевод строки', () => {
    const twoBlocks = {
      content: [
        { type: 'text', text: 'один' },
        { type: 'text', text: 'два' },
      ],
    };
    expect(resultText(twoBlocks)).toBe('один\nдва');
    expect(resultText({ contents: [{ uri: 'reformer://guide', text: '# Гид' }] })).toBe('# Гид');
    expect(resultText({ content: [{ type: 'image', data: 'AA==' }] })).toBe(
      '{"type":"image","data":"AA=="}'
    );
    expect(resultText({ other: 1 })).toBe('{"other":1}');
    expect(resultText(undefined)).toBeNull();
  });

  it('без пути трассы наблюдателя нет', () => {
    expect(createTraceSink(undefined)).toBeUndefined();
    expect(createTraceSink('')).toBeUndefined();
  });

  it('номер вызова считает только инструменты; полный режим добавляет аргументы и ответ', () => {
    const thrown: ReformerServerCall = {
      kind: 'tool',
      name: 'form_build',
      arguments: { dir: '../outside' },
      resultChars: 0,
      isError: true,
      protocolError: 'Путь вне проекта',
      durationMs: 1,
    };
    const calls = [
      tool('form_build', GRAMMAR_ARGS, GRAMMAR),
      resource('reformer://guide', '# Гид'),
      tool('form_build', BUILD_ARGS, FAILED, true),
      thrown,
    ];
    const briefFile = path.join(root, 'brief', 'trace.jsonl');
    const fullFile = path.join(root, 'full', 'trace.jsonl');
    const brief = createTraceSink(briefFile);
    const full = createTraceSink(fullFile, { full: true });
    for (const call of calls) {
      brief?.(call);
      full?.(call);
    }

    const short = readLines(briefFile);
    expect(short.map((entry) => entry.seq)).toEqual([1, 2, 3, 4]);
    expect(short.map((entry) => entry.call)).toEqual([1, undefined, 2, 3]);
    expect(short.map((entry) => entry.argumentsDigest)).toEqual(
      calls.map((call) => argumentsDigest(call.arguments))
    );
    expect(short[2]).toMatchObject({ kind: 'tool', isError: true, durationMs: 12 });
    for (const entry of short) {
      expect(entry).not.toHaveProperty('arguments');
      expect(entry).not.toHaveProperty('result');
    }

    const long = readLines(fullFile);
    expect(long[0]).toMatchObject({ call: 1, arguments: GRAMMAR_ARGS, result: GRAMMAR });
    expect(long[1]).toMatchObject({ kind: 'resource', arguments: null, result: '# Гид' });
    expect(long[1]).not.toHaveProperty('call');
    expect(long[2]).toMatchObject({ call: 2, arguments: BUILD_ARGS, result: FAILED });
    // Исключение: ответа нет, текст ошибки — в `protocolError`.
    expect(long[3]).toMatchObject({ call: 3, result: null, protocolError: 'Путь вне проекта' });
  });
});

describe('диалог прогона', () => {
  it('журнал Ollama: задание, системный промпт, шаги, вызовы с ответами и проверки', () => {
    const slug = 'L1-feedback.core.bare.ollama.r1';
    const usage = { inputTokens: 1200, outputTokens: 40, modelMs: 2500 };
    const written = { path: 'form/form.intent.json', content: '{}' };
    const nudge = 'Ты написал вызов form_build текстом, и он не выполнен.';
    const run = writeRun(slug, {
      prompt: PROMPT,
      transcript: [
        { step: 0, role: 'system', content: SYSTEM, tools: ['form_build', 'write_file'] },
        { step: 0, role: 'user', content: PROMPT },
        {
          step: 0,
          role: 'assistant',
          content: 'Сначала грамматика.',
          thinking: 'Нужна грамматика intent.',
          tool_calls: [{ function: { name: 'form_build', arguments: GRAMMAR_ARGS } }],
          usage,
        },
        {
          step: 0,
          role: 'tool',
          name: 'form_build',
          source: 'mcp',
          call: 1,
          argumentsDigest: evalDigest(GRAMMAR_ARGS),
          arguments: GRAMMAR_ARGS,
          ok: true,
          chars: GRAMMAR.length,
          content: GRAMMAR,
          sentChars: 20,
        },
        { step: 1, role: 'assistant', content: 'form_build {"dir":"form"}', usage },
        { step: 1, role: 'user', content: nudge, nudge: true },
        { step: 2, role: 'harness', truncated: 1 },
        {
          step: 2,
          role: 'assistant',
          content: '',
          tool_calls: [
            { function: { name: 'write_file', arguments: written } },
            { function: { name: 'form_build', arguments: BUILD_ARGS } },
          ],
          usage,
        },
        {
          step: 2,
          role: 'tool',
          name: 'write_file',
          source: 'workspace',
          arguments: written,
          ok: true,
          chars: 2,
          content: 'ok',
        },
        {
          step: 2,
          role: 'tool',
          name: 'form_build',
          source: 'mcp',
          call: 2,
          argumentsDigest: evalDigest(BUILD_ARGS),
          arguments: BUILD_ARGS,
          ok: true,
          chars: BUILT.length,
          content: BUILT,
        },
        { step: 3, role: 'assistant', content: 'Форма готова.', usage },
      ],
      calls: [tool('form_build', GRAMMAR_ARGS, GRAMMAR), tool('form_build', BUILD_ARGS, BUILT)],
      finalText: 'Форма готова.\n\n## Итог\n\nВсё.',
      record: {
        runId: `${BATCH}.${slug}`,
        scenario: { id: 'L1-feedback', target: 'core', level: 1 },
        agent: { kind: 'ollama', model: 'qwen3:8b' },
        verdict: 'fail',
        score: 0.5,
        exitReason: 'completed',
        durationMs: 61000,
        usage: { inputTokens: 3600, outputTokens: 120, turns: 4, toolCalls: 3, toolErrors: 0 },
        checks: {
          'static.tsc': 'pass',
          'render.fields': ['fail', 'нет поля `email`'],
          'e2e.submit': 'skip',
        },
        artifacts: { runDir: `.tmp/mcp-runs/${BATCH}/${slug}` },
      },
    });

    const read = readRun(run);
    expect(read.dialog.agent).toBe('ollama');
    expect(read.unmatched).toEqual([]);
    const dialog = renderRun(read);
    expect(dialog).toContain(`# ${BATCH}.${slug}`);
    expect(dialog).toContain('| Агент | ollama · qwen3:8b |');
    expect(dialog).toContain('| Вердикт | fail · счёт 0.5 · выход completed |');
    expect(dialog).toContain('**Проверки не прошли:**\n- `render.fields`: нет поля `email`');
    expect(dialog).toContain('Пропущены: `e2e.submit`.');
    expect(dialog).toContain('## Задание\n\n> # Задание\n>\n> Сделай форму');
    expect(dialog).toContain(`<details><summary>Системный промпт</summary>\n\n\`\`\`\n${SYSTEM}`);
    expect(dialog).toContain('### Шаг 1 · вход 1200 / выход 40 токенов · 2.5 с');
    expect(dialog).toContain('<details><summary>Рассуждение</summary>');
    expect(dialog).toContain(
      `**→ form_build** · вызов #1 · 12 мс · ответ ${GRAMMAR.length} симв. · до модели дошло 20`
    );
    expect(dialog).toContain(`<details><summary>Ответ</summary>\n\n\`\`\`\n${GRAMMAR}`);
    // Подсказка стенда и усечение старых ответов — перед шагом, к которому они пришли.
    expect(dialog).toContain(
      `### Шаг 3 · вход 1200 / выход 40 токенов · 2.5 с\n\n> Подсказка стенда: ${nudge}\n\n` +
        '> Стенд усёк старых ответов: 1.'
    );
    expect(dialog).toContain('**→ write_file** _(workspace)_ · ответ 2 симв.');
    expect(dialog).toContain(`**→ form_build** · вызов #2 · 12 мс · ответ ${BUILT.length} симв.`);
    expect(dialog).toContain('## Итог модели\n\n> Форма готова.\n>\n> ## Итог\n>\n> Всё.');
    expect(dialog).not.toContain('## Вызовы сервера вне журнала агента');
  });

  it('Claude Code: параллельные вызовы сходятся с трассой по отпечатку, а не по порядку', () => {
    const toolUse = (id: string, name: string, input: unknown) => ({
      type: 'assistant',
      message: { id: 'msg_1', content: [{ type: 'tool_use', id, name, input }] },
    });
    const toolResult = (id: string, content: unknown, isError = false) => ({
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: id, content, ...(isError ? { is_error: true } : {}) },
        ],
      },
    });
    const run = writeRun('L2-loan.core.bare.claude-code.r1', {
      prompt: PROMPT,
      transcript: [
        { type: 'system', subtype: 'init', model: 'claude-opus-5-5', mcp_servers: [] },
        {
          type: 'assistant',
          message: {
            id: 'msg_1',
            content: [{ type: 'thinking', thinking: 'Грамматика и сборка.' }],
          },
        },
        {
          type: 'assistant',
          message: { id: 'msg_1', content: [{ type: 'text', text: 'Беру грамматику.' }] },
        },
        toolUse('toolu_1', 'mcp__reformer__form_build', GRAMMAR_ARGS),
        toolUse('toolu_2', 'mcp__reformer__form_build', BUILD_ARGS),
        toolResult('toolu_2', [{ type: 'text', text: FAILED }], true),
        toolResult('toolu_1', [{ type: 'text', text: GRAMMAR }]),
        {
          type: 'assistant',
          message: {
            id: 'msg_2',
            content: [
              { type: 'tool_use', id: 'toolu_3', name: 'Write', input: { file_path: 'x' } },
            ],
          },
        },
        toolResult('toolu_3', 'File created'),
        {
          type: 'assistant',
          message: { id: 'msg_3', content: [{ type: 'text', text: 'Готово.' }] },
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Готово.',
          total_cost_usd: 0.1,
          num_turns: 3,
        },
      ],
      // Параллельные вызовы пришли на сервер в обратном порядке.
      calls: [
        tool('form_build', BUILD_ARGS, FAILED, true),
        tool('form_build', GRAMMAR_ARGS, GRAMMAR),
      ],
    });

    const read = readRun(run);
    expect(read.dialog.agent).toBe('claude-code');
    expect(read.dialog.meta).toMatchObject({ model: 'claude-opus-5-5', final: 'Готово.' });
    expect(read.dialog.steps).toHaveLength(3);
    const [grammar, build] = read.dialog.steps[0].calls;
    expect(grammar).toMatchObject({ name: 'form_build', source: 'mcp', result: GRAMMAR, ok: true });
    expect(grammar.trace.call).toBe(2);
    expect(build).toMatchObject({ name: 'form_build', result: FAILED, ok: false });
    expect(build.trace.call).toBe(1);
    expect(read.unmatched).toEqual([]);

    const dialog = renderRun(read);
    expect(dialog).toContain('_Записи прогона в records.jsonl батча нет._');
    expect(dialog).toContain('Беру грамматику.');
    expect(dialog).toContain(
      `**→ form_build** · вызов #1 · 12 мс · ответ ${FAILED.length} симв. · **ошибка**`
    );
    // Ответ с ошибкой раскрыт сразу.
    expect(dialog).toContain(`<details open><summary>Ответ</summary>\n\n\`\`\`\n${FAILED}`);
    expect(dialog).toContain('**→ Write** _(workspace)_ · ответ 12 симв.');
    // Без final.txt итог берётся из результата stream-json.
    expect(dialog).toContain('## Итог модели\n\n> Готово.');
  });

  it('повтор без журнала агента: вызовы и ответы — из трассы, ресурс — вне журнала', () => {
    const run = writeRun('L5-loan.core.bare.replay.r1', {
      prompt: PROMPT,
      calls: [
        tool('plan_form', { specPath: 'spec.md' }, 'черновик intent'),
        resource('reformer://guide', '# Гид'),
        tool('form_build', BUILD_ARGS, BUILT),
      ],
      finalText: '',
    });

    const read = readRun(run);
    expect(read.dialog.agent).toBeNull();
    const names = read.dialog.steps.map((step: DialogStep) => step.calls[0].name);
    expect(names).toEqual(['plan_form', 'form_build']);
    expect(read.dialog.steps[1].calls[0]).toMatchObject({ result: BUILT, ok: true });
    expect(read.unmatched.map((entry: TraceLine) => entry.name)).toEqual(['reformer://guide']);

    const dialog = renderRun(read);
    expect(dialog).toContain('_Агент без модели: вызовы — из трассы сервера._');
    expect(dialog).toContain('**→ plan_form** · вызов #1 · 12 мс · ответ 15 симв.');
    expect(dialog).toContain('черновик intent');
    expect(dialog).toContain('**→ form_build** · вызов #2');
    expect(dialog).toContain('## Вызовы сервера вне журнала агента');
    expect(dialog).toMatch(
      /- \d\d:\d\d:\d\d resource `reformer:\/\/guide` · 3 мс · ответ 5 симв\./
    );
    expect(dialog).toContain('## Итог модели\n\n_пусто_');
  });

  it('прежний журнал Ollama без ответов: ответ и номер — из полной трассы', () => {
    const transcript = [
      {
        step: 0,
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'form_build', arguments: BUILD_ARGS } }],
      },
      { step: 0, role: 'tool', name: 'form_build', ok: true, chars: BUILT.length },
      { step: 1, role: 'assistant', content: 'Готово.', tool_calls: [] },
    ];
    const calls = [tool('form_build', BUILD_ARGS, BUILT)];

    const full = readRun(writeRun('old.full', { transcript, calls }));
    expect(full.dialog.steps[0].calls[0]).toMatchObject({ source: 'mcp', result: BUILT, ok: true });
    const dialog = renderRun(full);
    expect(dialog).toContain('_нет prompt.md_');
    expect(dialog).toContain(`**→ form_build** · вызов #1 · 12 мс · ответ ${BUILT.length} симв.`);
    expect(dialog).toContain(BUILT);

    // Без полной трассы ответа взять неоткуда: строка вызова есть, раздела «Ответ» нет.
    const brief = renderRun(readRun(writeRun('old.brief', { transcript, calls, full: false })));
    expect(brief).toContain('**→ form_build** · вызов #1 · 12 мс');
    expect(brief).not.toContain('<summary>Ответ</summary>');
  });

  it('длинный ответ усекается по --max, 0 — целиком; ограда длиннее кавычек ответа', () => {
    const long = `${'а'.repeat(50)}\n\`\`\`ts\nconst x = 1;\n\`\`\``;
    const run = writeRun('long.replay', { calls: [tool('form_build', BUILD_ARGS, long)] });

    const clipped = renderRun(readRun(run), { max: 10 });
    expect(clipped).toContain(
      `${'а'.repeat(10)}\n… [ещё ${long.length - 10} симв.; --max 0 — целиком]`
    );

    const whole = renderRun(readRun(run), { max: 0 });
    expect(whole).toContain(`\`\`\`\`\n${long}\n\`\`\`\``);
  });
});
