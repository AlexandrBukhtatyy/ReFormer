/**
 * Агент Ollama от начала до конца: модель подменена записанными ответами (`node:http`), сервер —
 * настоящий `dist/index.js`. Проверяется журнал прогона (ReFormer-qo9b.37): в нём то, что ушло
 * модели, ответ сервера совпадает с трассой, а журнал и трасса сходятся по номеру вызова и отпечатку.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimOllama,
  cutNotice,
  isEmptyCall,
  isToolCallParseError,
  ollamaLockFile,
  OUTPUT_LIMIT,
  releaseOllama,
  runAgent,
  stepLine,
  systemPrompt,
  unparsedNotice,
  waitLine,
} from '../eval/agents/ollama.mjs';
import { argumentsDigest } from '../eval/lib/digest.mjs';
import { readRun, renderRun } from '../eval/lib/run-log.mjs';
import { SERVER_INSTRUCTIONS } from '../src/platform/cli/server';
import { precondition } from './support/preconditions';

interface ChatMessage {
  readonly role: string;
  readonly content: string;
  readonly tool_name?: string;
}

interface ChatBody {
  readonly messages: readonly ChatMessage[];
  readonly options?: { readonly num_ctx?: number; readonly num_predict?: number };
}

/**
 * Ответы «модели» по порядку и тела запросов к ней. Ответ с `failure` — ошибка Ollama: код и тело
 * как есть.
 */
const chat = vi.hoisted(() => ({ replies: [] as unknown[], bodies: [] as ChatBody[] }));

vi.mock('node:http', async () => {
  const { EventEmitter } = await import('node:events');
  function request(_url: string, _options: unknown, onResponse: (response: unknown) => void) {
    const outgoing = Object.assign(new EventEmitter(), {
      end(body: string) {
        chat.bodies.push(JSON.parse(body) as ChatBody);
        const reply = chat.replies.shift() as { failure?: { status: number; body: string } };
        const failure = reply?.failure;
        const response = Object.assign(new EventEmitter(), { statusCode: failure?.status ?? 200 });
        onResponse(response);
        setImmediate(() => {
          response.emit('data', Buffer.from(failure ? failure.body : JSON.stringify(reply)));
          response.emit('end');
        });
      },
    });
    return outgoing;
  }
  return { default: { request }, request };
});

const packageRoot = path.resolve(__dirname, '..');
const distEntry = path.join(packageRoot, 'dist/index.js');
const hasDist = precondition(
  'сборка сервера',
  existsSync(distEntry),
  'npm run build -w @reformer/mcp'
);

type Entry = Record<string, unknown> & { role?: string; kind?: string };

const readJsonl = (file: string): Entry[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Entry);

const reply = (message: Record<string, unknown>) => ({
  message: { role: 'assistant', content: '', ...message },
  prompt_eval_count: 900,
  eval_count: 30,
  total_duration: 1_500_000_000,
});

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'ollama-agent-'));
  chat.replies.length = 0;
  chat.bodies.length = 0;
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('агент Ollama: системный промпт', () => {
  it('инструкции сервера — разделом после своего промпта; без них — только свой', () => {
    const own = systemPrompt(null);
    expect(own).not.toContain('MCP Server Instructions');
    expect(systemPrompt('')).toBe(own);
    const full = systemPrompt('Use form_build.');
    expect(full.startsWith(own)).toBe(true);
    expect(full.endsWith('# MCP Server Instructions\n\n## reformer\nUse form_build.')).toBe(true);
  });
});

describe('агент Ollama: ход прогона и одна Ollama на батч [ReFormer-qo9b.41]', () => {
  const at = new Date(2026, 10, 12, 8, 7, 26);

  it('строка шага: время, прогон, шаг, время модели и вызовы с пометкой ошибки', () => {
    const calls = [
      { name: 'validate_form', ok: false },
      { name: 'list_files', ok: true },
    ];
    expect(stepLine({ at, slug: 'L2.r1', step: 6, modelMs: 9081, calls })).toBe(
      '  08:07:26 · L2.r1 · шаг 6 · модель 9 с · validate_form ✗, list_files'
    );
    expect(stepLine({ at, slug: 'L2.r1', step: 7, modelMs: 400, calls: [] })).toBe(
      '  08:07:26 · L2.r1 · шаг 7 · модель 0 с · ответ без вызова'
    );
    // Вызов без аргументов — `∅` перед пометкой ошибки [ReFormer-mhsh.8].
    expect(
      stepLine({
        at,
        slug: 'L2.r1',
        step: 8,
        modelMs: 1200,
        calls: [{ name: 'execute', ok: false, empty: true }],
      })
    ).toBe('  08:07:26 · L2.r1 · шаг 8 · модель 1 с · execute ∅ ✗');
    expect(waitLine({ at, slug: 'L2.r1', step: 10, waitedMs: 120_400 })).toBe(
      '  08:07:26 · L2.r1 · шаг 10 · ждёт модель 120 с'
    );
  });

  it('файл занятости — свой на адрес Ollama', () => {
    expect(path.basename(ollamaLockFile('http://localhost:11434', root))).toBe(
      '.ollama-localhost-11434.lock'
    );
    expect(ollamaLockFile('http://gpu.lan:8080', root)).not.toBe(
      ollamaLockFile('http://localhost:11434', root)
    );
  });

  it('живой владелец не пускает второй батч; мёртвый, испорченный файл и свой — не помеха', () => {
    const lockFile = path.join(root, 'runs', '.ollama-test.lock');
    const alive = new Set([111]);
    const isAlive = (pid: number) => alive.has(pid);
    const claim = (pid: number) => claimOllama({ lockFile, pid, isAlive, now: at, command: 'x' });

    expect(claim(111)).toEqual({ ok: true });
    expect(JSON.parse(readFileSync(lockFile, 'utf8'))).toEqual({
      pid: 111,
      startedAt: at.toISOString(),
      command: 'x',
    });
    // Другой процесс при живом владельце — отказ с владельцем.
    expect(claim(222)).toEqual({
      ok: false,
      holder: { pid: 111, startedAt: at.toISOString(), command: 'x' },
    });
    // Повтор своего захвата (вторая модель матрицы) — не помеха.
    expect(claim(111)).toEqual({ ok: true });
    // Владелец снят Ctrl+C и файл не убрал: Ollama свободна.
    alive.delete(111);
    expect(claim(222)).toEqual({ ok: true });
    writeFileSync(lockFile, '{ not json');
    expect(claim(333)).toEqual({ ok: true });

    // Убрать можно только свой файл.
    releaseOllama({ lockFile, pid: 222 });
    expect(existsSync(lockFile)).toBe(true);
    releaseOllama({ lockFile, pid: 333 });
    expect(existsSync(lockFile)).toBe(false);
  });
});

describe('агент Ollama: ошибки формата вызова [ReFormer-mhsh.8]', () => {
  const xml = {
    status: 500,
    body: '{"error":"XML syntax error on line 3: element \\u003cfunction\\u003e closed by \\u003c/parameter\\u003e"}',
  };

  it('ошибка разбора вызова — только 500 с разбором вызова; память и контекст — сбой канала', () => {
    expect(isToolCallParseError(xml)).toBe(true);
    expect(
      isToolCallParseError({ status: 500, body: '{"error":"error parsing tool call: x"}' })
    ).toBe(true);
    expect(
      isToolCallParseError({
        status: 500,
        body: '{"error":"model requires 16.9 GiB but only 11.3 GiB are available"}',
      })
    ).toBe(false);
    expect(isToolCallParseError({ status: 500, body: '{"error":"no user query found"}' })).toBe(
      false
    );
    expect(isToolCallParseError({ status: 400, body: xml.body })).toBe(false);
    expect(isToolCallParseError(new Error('socket hang up'))).toBe(false);
  });

  it('вызов без аргументов — пустые аргументы при обязательных параметрах', () => {
    const schema = { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] };
    expect(isEmptyCall({}, schema)).toBe(true);
    expect(isEmptyCall(undefined, schema)).toBe(true);
    expect(isEmptyCall({ code: 'x' }, schema)).toBe(false);
    // Инструмент без обязательных параметров зовут без аргументов законно.
    expect(isEmptyCall({}, { type: 'object', properties: {} })).toBe(false);
    expect(isEmptyCall({}, undefined)).toBe(false);
  });

  it('сообщение модели называет ошибку Ollama, а не тело ответа целиком', () => {
    const notice = unparsedNotice(xml);
    expect(notice).toContain('не разобран');
    expect(notice).toContain(
      'XML syntax error on line 3: element <function> closed by </parameter>'
    );
    expect(notice).not.toContain('{"error"');
  });
});

describe.runIf(hasDist)('агент Ollama: журнал прогона', () => {
  it('журнал хранит то, что ушло модели, и сходится с трассой сервера', async () => {
    const runDirectory = path.join(root, 'batch', 'L1-test.core.bare.ollama.r1');
    const workspaceDirectory = path.join(root, 'workspace');
    mkdirSync(runDirectory, { recursive: true });
    mkdirSync(workspaceDirectory, { recursive: true });
    const args = { requirement: 'скрыть поле, пока чекбокс не отмечен' };
    const guide = { uri: 'reformer://guide' };
    chat.replies.push(
      reply({
        content: 'Выбираю оператор.',
        thinking: 'Нужен оператор видимости.',
        tool_calls: [
          { function: { name: 'choose_api', arguments: args } },
          { function: { name: 'read_mcp_resource', arguments: guide } },
        ],
      }),
      // Вызов текстом: стенд один раз подсказывает модели.
      reply({ content: 'Вызываю choose_api({"requirement": "x"})' }),
      reply({ content: 'Готово.' })
    );

    const progress: string[] = [];
    const result = await runAgent({
      scenario: { id: 'L1-test' },
      target: 'core',
      workspaceDirectory,
      runDirectory,
      prompt: 'Сделай форму обратной связи.',
      model: 'fake-model',
      approach: { id: 'bare' },
      serverPath: distEntry,
      traceFile: path.join(runDirectory, 'server-trace.jsonl'),
      limits: { timeoutMs: 60_000, maxUsd: 0, maxSteps: 5 },
      settings: { numCtx: 32768 },
      onProgress: (line: string) => progress.push(line),
    });
    expect(result.exitReason).toBe('completed');
    expect(result.finalText).toBe('Готово.');
    // Строка на каждый шаг — с файловыми и прочими вызовами, которых нет в трассе сервера.
    const shape = (step: number, tools: string) =>
      new RegExp(
        `^ {2}\\d\\d:\\d\\d:\\d\\d · L1-test\\.core\\.bare\\.ollama\\.r1 · шаг ${step} · модель 2 с · ${tools}$`
      );
    expect(progress).toHaveLength(3);
    expect(progress[0]).toMatch(shape(0, 'choose_api, read_mcp_resource'));
    expect(progress[1]).toMatch(shape(1, 'ответ без вызова'));
    expect(progress[2]).toMatch(shape(2, 'ответ без вызова'));

    const transcript = readJsonl(path.join(runDirectory, 'transcript.jsonl'));
    const [system, prompt] = transcript;
    expect(system).toMatchObject({ step: 0, role: 'system' });
    expect(system.tools).toEqual(expect.arrayContaining(['choose_api', 'read_mcp_resource']));
    expect(system.content).toBe(chat.bodies[0].messages[0].content);
    // Инструкции сервера доходят до модели, как в Claude Code [ReFormer-qo9b.38].
    expect(system.serverInstructions).toBe(true);
    expect(system.content).toBe(systemPrompt(SERVER_INSTRUCTIONS));
    expect(system.content).toContain('form_build {"grammar":"base"}');
    expect(prompt).toEqual({ step: 0, role: 'user', content: 'Сделай форму обратной связи.' });
    expect(transcript.find((entry) => entry.role === 'assistant')).toMatchObject({
      thinking: 'Нужен оператор видимости.',
      usage: { inputTokens: 900, outputTokens: 30, modelMs: 1500 },
    });
    expect(transcript.find((entry) => entry.nudge === true)).toMatchObject({
      role: 'user',
      step: 1,
    });

    const [toolEntry, resourceEntry] = transcript.filter((entry) => entry.role === 'tool');
    expect(toolEntry).toMatchObject({
      name: 'choose_api',
      source: 'mcp',
      call: 1,
      argumentsDigest: argumentsDigest(args),
      arguments: args,
      ok: true,
    });
    expect(String(toolEntry.content).length).toBe(toolEntry.chars);
    expect(resourceEntry).toMatchObject({
      name: 'read_mcp_resource',
      source: 'resource',
      ok: true,
    });
    expect(resourceEntry).not.toHaveProperty('call');

    // Что получила модель, то и отдал сервер: ответ целиком, тот же номер и отпечаток.
    const trace = readJsonl(path.join(runDirectory, 'server-trace.jsonl'));
    const served = trace.find((entry) => entry.kind === 'tool');
    expect(served).toMatchObject({
      call: 1,
      name: 'choose_api',
      argumentsDigest: toolEntry.argumentsDigest,
      arguments: args,
      result: toolEntry.content,
    });
    const sentToModel = chat.bodies[1].messages.filter((message) => message.role === 'tool');
    expect(sentToModel[0]).toEqual({
      role: 'tool',
      tool_name: 'choose_api',
      content: toolEntry.content,
    });
    // Длинный ресурс стенд усекает: журнал знает, сколько из него дошло до модели.
    expect(resourceEntry.sentChars ?? resourceEntry.chars).toBe(sentToModel[1].content.length);

    const run = readRun(runDirectory);
    expect(run.unmatched).toEqual([]);
    const dialog = renderRun(run);
    expect(dialog).toContain('## Задание\n\n> Сделай форму обратной связи.');
    expect(dialog).toContain('<details><summary>Системный промпт</summary>');
    expect(dialog).toMatch(/\*\*→ choose_api\*\* · вызов #1 · \d+ мс · ответ \d+ симв\./);
    expect(dialog).toContain('**→ read_mcp_resource** _(resource)_');
    expect(dialog).toContain('> Подсказка стенда: Ты написал вызов choose_api текстом');
    expect(dialog).toContain('## Итог модели\n\n> Готово.');
  }, 60_000);

  const runWith = async (slug: string, settings: Record<string, unknown> = {}) => {
    const runDirectory = path.join(root, 'batch', slug);
    const workspaceDirectory = path.join(root, `workspace-${slug}`);
    mkdirSync(runDirectory, { recursive: true });
    mkdirSync(workspaceDirectory, { recursive: true });
    const progress: string[] = [];
    const result = await runAgent({
      scenario: { id: 'L1-test' },
      target: 'core',
      workspaceDirectory,
      runDirectory,
      prompt: 'Сделай форму обратной связи.',
      model: 'fake-model',
      approach: { id: 'bare' },
      serverPath: distEntry,
      traceFile: path.join(runDirectory, 'server-trace.jsonl'),
      limits: { timeoutMs: 60_000, maxUsd: 0, maxSteps: 5 },
      settings: { numCtx: 32768, ...settings },
      onProgress: (line: string) => progress.push(line),
    });
    return { result, progress, runDirectory };
  };

  it('пустой вызов помечен; неразобранный ответ — шаг с сообщением модели, прогон идёт дальше [ReFormer-mhsh.8]', async () => {
    chat.replies.push(
      reply({ tool_calls: [{ function: { name: 'choose_api', arguments: {} } }] }),
      {
        failure: {
          status: 500,
          body: '{"error":"XML syntax error on line 3: element \\u003cfunction\\u003e closed by \\u003c/parameter\\u003e"}',
        },
      },
      reply({ content: 'Готово.' })
    );
    const { result, progress, runDirectory } = await runWith('L1-test.core.bare.empty.r1');

    // Ошибка формата вызова — ошибка модели: прогон не обрывается и не становится сбоем канала.
    expect(result.exitReason).toBe('completed');
    expect(result.harness).toMatchObject({ emptyCalls: 1, unparsedCalls: 1 });
    expect(result.usage.turns).toBe(3);
    expect(progress[0]).toMatch(/· шаг 0 · модель 2 с · choose_api ∅ ✗$/);
    expect(progress[1]).toMatch(/· шаг 1 · модель \d+ с · вызов не разобран ✗$/);

    // Модель узнаёт об ошибке сообщением после своего прежнего контекста.
    const lastSent = chat.bodies[2].messages.at(-1);
    expect(lastSent?.role).toBe('user');
    expect(lastSent?.content).toContain('XML syntax error on line 3');

    const transcript = readJsonl(path.join(runDirectory, 'transcript.jsonl'));
    expect(transcript.find((entry) => entry.role === 'tool')).toMatchObject({
      name: 'choose_api',
      emptyArguments: true,
      ok: false,
    });
    expect(transcript.find((entry) => entry.role === 'harness')).toMatchObject({
      step: 1,
      unparsed: expect.stringContaining('XML syntax error'),
    });

    const dialog = renderRun(readRun(runDirectory));
    expect(dialog).toContain('**→ choose_api** · **без аргументов**');
    expect(dialog).toContain(
      '> Ответ модели перед этим шагом потерян: Ollama не разобрала в нём вызов'
    );
  }, 60_000);

  it('прочая ошибка Ollama — сбой канала: прогон кончается ошибкой', async () => {
    chat.replies.push({
      failure: {
        status: 500,
        body: '{"error":"model requires 16.9 GiB but only 11.3 GiB are available"}',
      },
    });
    const { result } = await runWith('L1-test.core.bare.memory.r1');
    expect(result.exitReason).toBe('error');
    expect(result.finalText).toContain('model requires 16.9 GiB');
    expect(result.harness.unparsedCalls).toBe(0);
  }, 60_000);

  it('выход ограничен; обрыв без вызова — сообщение модели и шаг дальше, а не «готово» [ReFormer-mhsh.9]', async () => {
    const cut = (message: Record<string, unknown>) => ({
      ...reply(message),
      done_reason: 'length',
      eval_count: 500,
    });
    chat.replies.push(
      // Ollama отбрасывает недописанный вызов: ответ пустой, без tool_calls.
      cut({ content: '' }),
      // Вызов успел дописаться до предела — выполняется как обычно.
      cut({ tool_calls: [{ function: { name: 'choose_api', arguments: { requirement: 'x' } } }] }),
      reply({ content: 'Готово.' })
    );
    const { result, progress, runDirectory } = await runWith('L1-test.core.bare.cut.r1', {
      numPredict: 500,
    });

    expect(chat.bodies.map((body) => body.options?.num_predict)).toEqual([500, 500, 500]);
    expect(result.exitReason).toBe('completed');
    expect(result.finalText).toBe('Готово.');
    expect(result.harness.lengthStops).toBe(2);
    expect(progress[0]).toMatch(/· шаг 0 · модель 2 с · ответ оборван на 500 токенах ✗$/);
    expect(progress[1]).toMatch(/· шаг 1 · модель 2 с · choose_api$/);

    // Обрывок в историю не идёт: за заданием сразу сообщение об обрыве.
    const second = chat.bodies[1].messages;
    expect(second.map((message) => message.role)).toEqual(['system', 'user', 'user']);
    expect(second.at(-1)?.content).toBe(cutNotice(500));

    const transcript = readJsonl(path.join(runDirectory, 'transcript.jsonl'));
    expect(transcript.filter((entry) => entry.role === 'assistant')[0]).toMatchObject({
      cut: true,
      outputLimit: 500,
    });
    const dialog = renderRun(readRun(runDirectory));
    expect(dialog).toContain(
      '> Ответ оборван пределом выхода (500 токенов): недописанный вызов отброшен'
    );
  }, 60_000);

  it('предел выхода по умолчанию — с запасом над самым длинным законным шагом', async () => {
    expect(OUTPUT_LIMIT).toBeGreaterThan(9328 * 1.5);
    chat.replies.push(reply({ content: 'Готово.' }));
    const { result } = await runWith('L1-test.core.bare.limit.r1');
    expect(chat.bodies[0].options?.num_predict).toBe(OUTPUT_LIMIT);
    expect(result.harness.lengthStops).toBe(0);
  }, 60_000);
});
