/**
 * Агент на локальной модели через Ollama: свой цикл вызовов инструментов.
 *
 * Нативный `POST /api/chat` без AI SDK: в корне репозитория лежит `ai@5`, у конструктора — `ai@7`, и
 * импорт отсюда разрешился бы не в ту версию. Токены — точные, из ответа Ollama.
 *
 * Контекст модели ограничен, поэтому старые ответы инструментов усекаются — кроме ответов генератора
 * ({@link KEEP_WHOLE_TOOLS}). Это вмешательство прибора: число усечений и длина ответов генератора
 * попадают в запись прогона.
 *
 * Системный промпт — свой плюс инструкции сервера из `initialize`, как у Claude Code
 * ({@link systemPrompt}).
 *
 * Журнал (`transcript.jsonl`) — весь разговор, а не только реплики модели: системный промпт и
 * задание, рассуждение, вызовы с аргументами, полный текст ответа и то, что из него дошло до модели,
 * подсказки и усечения стенда. Ответ сервера — главное, что нужно при разборе ошибки малой модели, а
 * прежде от него оставались только имя и длина (ReFormer-qo9b.37). Вызов инструмента MCP несёт номер
 * `call` и отпечаток аргументов — общий ключ с трассой сервера (`server-trace.jsonl`).
 */

import { createWriteStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { McpClient } from '../lib/client.mjs';
import { argumentsDigest } from '../lib/digest.mjs';
import { repoRoot } from '../records/record.mjs';
import { findTextualCall } from './textual-call.mjs';
import { runWorkspaceTool, WORKSPACE_TOOLS } from './workspace-tools.mjs';

export const kind = 'ollama';

/** Шаг локальной модели занимает минуты: бюджет времени сценария рассчитан на облачную модель. */
export const timeoutFactor = 2.5;

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const KEEP_FULL_LAST_RESULTS = 4;
const OLD_RESULT_CHARS = 1500;
const READ_RESOURCE_TOOL = {
  name: 'read_mcp_resource',
  description: 'Read a resource of the reformer MCP server by its URI, e.g. reformer://guide.',
  inputSchema: {
    type: 'object',
    properties: { uri: { type: 'string' } },
    required: ['uri'],
  },
};

const SYSTEM_PROMPT = `You are a software developer working in a project directory. Do the task by calling the tools: the reformer MCP server tools give knowledge about the @reformer form library, the file tools change files in the working directory. Files exist only if you write them with write_file: printing code in a message does not create it.`;

/**
 * Системный промпт с инструкциями сервера из `initialize` — так их видит модель в Claude Code
 * (раздел «MCP Server Instructions»). Без них стенд мерил сервер без его главной подсказки о
 * маршруте: qwen3.5:4b не вызвал ни одного инструмента MCP, gemma4:26b пошла в `plan_form` с
 * выдуманной спекой (ReFormer-qo9b.38).
 */
export function systemPrompt(instructions) {
  if (!instructions) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n# MCP Server Instructions\n\n## reformer\n${instructions}`;
}

/** Проверка до батча: сервер Ollama отвечает и модель загружена. */
export async function preflight(model) {
  const response = await fetch(`${BASE_URL}/api/tags`).catch(() => null);
  if (!response?.ok) return `Ollama не отвечает на ${BASE_URL}`;
  const { models } = await response.json();
  return models.some((item) => item.name === model) ? null : `В Ollama нет модели ${model}`;
}

/**
 * Запрос к Ollama без предела ожидания ответа. У `fetch` в Node заголовки ждутся 5 минут, а модель с
 * большим контекстом думает дольше: связь рвал бы сам стенд. Предел задаёт только таймаут сценария.
 */
function postChat(body, signal) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      `${BASE_URL}/api/chat`,
      { method: 'POST', signal, headers: { 'content-type': 'application/json' } },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (response.statusCode === 200) resolve(JSON.parse(text));
          else reject(new Error(`Ollama ${response.statusCode}: ${text.slice(0, 300)}`));
        });
      }
    );
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });
}

const toFunction = (tool) => ({
  type: 'function',
  function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
});

/**
 * Ответы, которые модель держит целиком: грамматика и диагностика `form_build`, сводка `plan_form`.
 * Усечённую грамматику модель дописывала бы по памяти, и замер судил бы стенд, а не сервер
 * (ReFormer-qo9b.31: прогон qwen L1-feedback, 135 усечений при контексте 32k). Их длина попадает в
 * запись прогона.
 */
export const KEEP_WHOLE_TOOLS = new Set(['plan_form', 'form_build']);

/** Грубая оценка символов на токен: код и английский текст. */
const CHARS_PER_TOKEN = 3;
/** Доля контекста модели, которую может занять один ответ. */
const RESPONSE_SHARE = 0.35;

/** Потолок одного ответа инструмента или ресурса в символах для контекста `numCtx` токенов. */
export function responseCap(numCtx) {
  return Math.floor(numCtx * CHARS_PER_TOKEN * RESPONSE_SHARE);
}

/**
 * Ответ длиннее потолка — усечь с пометкой стенда (ReFormer-qo9b.36).
 *
 * Без этого ответ длиннее контекста уходил в Ollama целиком, и она сама отбрасывала начало переписки
 * вместе с заданием: прогон падал «500 no user query found» (батч f7d3, ресурс guide на 70 тыс.
 * символов при контексте 32k). Пометка видна модели, а счётчик — записи прогона.
 */
export function capResponse(text, cap) {
  if (text.length <= cap) return { text, cut: false };
  return {
    text: `${text.slice(0, cap)}\n… [ответ длиннее контекста модели (${text.length} символов) — усечён стендом]`,
    cut: true,
  };
}

/** Усечь старые ответы инструментов; возвращает число усечённых за этот шаг. */
export function truncateOldResults(messages) {
  const results = messages.filter(
    (message) => message.role === 'tool' && !KEEP_WHOLE_TOOLS.has(message.tool_name)
  );
  let truncated = 0;
  for (const message of results.slice(0, -KEEP_FULL_LAST_RESULTS)) {
    if (message.content.length > OLD_RESULT_CHARS) {
      message.content = `${message.content.slice(0, OLD_RESULT_CHARS)}\n… [ответ усечён стендом: контекст модели ограничен]`;
      truncated++;
    }
  }
  return truncated;
}

/** @param {import('./types.mjs').AgentInput} input */
export async function runAgent(input) {
  const startedAt = Date.now();
  const { limits, settings = {} } = input;
  const transcriptPath = path.join(input.runDirectory, 'transcript.jsonl');
  const transcript = createWriteStream(transcriptPath);
  const log = (entry) => transcript.write(`${JSON.stringify(entry)}\n`);
  const client = new McpClient(input.serverPath, {
    env: {
      REFORMER_TRACE_FILE: input.traceFile,
      // Полная трасса: аргументы и ответы сервера целиком — для разбора прогона (`npm run mcp:log`).
      REFORMER_TRACE_FULL: '1',
      // Как у claude-code: агент вне репозитория, а типы формы form_build проверяет с настоящими
      // пакетами. Без этого проверка типов недоступна, и запасная проверка импортов на снимке
      // сервера без соседних пакетов отвергает собственный код генератора (батч f7d3).
      REFORMER_TYPECHECK_ROOT: repoRoot,
    },
    cwd: input.workspaceDirectory,
  });
  const toolCalls = [];
  const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0, turns: 0, modelMs: 0 };
  const harness = {
    truncations: 0,
    textualCalls: 0,
    keptWhole: 0,
    keptWholeMaxChars: 0,
    overflows: 0,
  };
  const cap = responseCap(settings.numCtx ?? 32768);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  let exitReason = 'maxSteps';
  let finalText = '';

  try {
    const { instructions } = await client.initialize();
    const system = systemPrompt(instructions);
    const listed = (await client.request('tools/list', {})).result?.tools ?? [];
    const withoutTools = new Set(input.approach.withoutTools ?? []);
    const mcpTools = listed.filter((tool) => !withoutTools.has(tool.name));
    const mcpNames = new Set(mcpTools.map((tool) => tool.name));
    const tools = [...mcpTools, READ_RESOURCE_TOOL, ...WORKSPACE_TOOLS];
    const toolNames = tools.map((tool) => tool.name);

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: input.prompt },
    ];
    log({
      step: 0,
      role: 'system',
      content: system,
      tools: toolNames,
      serverInstructions: instructions !== null,
    });
    log({ step: 0, role: 'user', content: input.prompt });
    let nudged = false;
    /** Номер вызова инструмента MCP — тот же счёт, что `call` в трассе сервера. */
    let mcpCalls = 0;

    for (let step = 0; step < limits.maxSteps; step++) {
      const truncated = truncateOldResults(messages);
      harness.truncations += truncated;
      if (truncated > 0) log({ step, role: 'harness', truncated });
      const reply = await postChat(
        {
          model: input.model,
          messages,
          tools: tools.map(toFunction),
          stream: false,
          think: settings.think ?? false,
          keep_alive: '30m',
          options: { num_ctx: settings.numCtx ?? 32768 },
        },
        controller.signal
      );
      usage.turns++;
      usage.inputTokens += reply.prompt_eval_count ?? 0;
      usage.outputTokens += reply.eval_count ?? 0;
      usage.modelMs += Math.round((reply.total_duration ?? 0) / 1e6);
      const { message } = reply;
      log({
        step,
        role: 'assistant',
        content: message.content,
        ...(message.thinking ? { thinking: message.thinking } : {}),
        tool_calls: message.tool_calls,
        usage: {
          inputTokens: reply.prompt_eval_count ?? 0,
          outputTokens: reply.eval_count ?? 0,
          modelMs: Math.round((reply.total_duration ?? 0) / 1e6),
        },
      });
      messages.push(message);

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        const textual = findTextualCall(message.content ?? '', toolNames);
        if (textual) harness.textualCalls++;
        if (textual && !nudged && settings.nudges !== false) {
          // Модель написала вызов текстом и считает работу сделанной. Один раз подсказываем: это
          // свойство модели, а не сервера, но без подсказки сценарий мерил бы только его.
          nudged = true;
          const nudge = `Ты написал вызов ${textual} текстом, и он не выполнен. Вызови инструмент по-настоящему.`;
          messages.push({ role: 'user', content: nudge });
          log({ step, role: 'user', content: nudge, nudge: true });
          continue;
        }
        finalText = message.content ?? '';
        exitReason = 'completed';
        break;
      }

      for (const call of calls) {
        const name = call.function?.name;
        const argumentsValue = call.function?.arguments ?? {};
        let result;
        let source = 'unknown';
        if (mcpNames.has(name)) {
          source = 'mcp';
          mcpCalls++;
          const reply_ = await client.callTool(name, argumentsValue);
          result = {
            ok: !reply_.error && reply_.result?.isError !== true,
            text: reply_.text || JSON.stringify(reply_.error),
          };
        } else if (name === READ_RESOURCE_TOOL.name) {
          source = 'resource';
          const reply_ = await client.readResource(argumentsValue.uri);
          result = { ok: !reply_.error, text: reply_.text || JSON.stringify(reply_.error) };
        } else if (WORKSPACE_TOOLS.some((tool) => tool.name === name)) {
          source = 'workspace';
          result = runWorkspaceTool(input.workspaceDirectory, name, argumentsValue);
        } else {
          result = { ok: false, text: `Неизвестный инструмент: ${name}` };
        }
        toolCalls.push({ name, ok: result.ok });
        if (KEEP_WHOLE_TOOLS.has(name)) {
          harness.keptWhole++;
          harness.keptWholeMaxChars = Math.max(harness.keptWholeMaxChars, result.text.length);
        }
        const capped = capResponse(result.text, cap);
        if (capped.cut) harness.overflows++;
        log({
          step,
          role: 'tool',
          name,
          source,
          ...(source === 'mcp'
            ? { call: mcpCalls, argumentsDigest: argumentsDigest(argumentsValue) }
            : {}),
          arguments: argumentsValue,
          ok: result.ok,
          chars: result.text.length,
          content: result.text,
          // Что из ответа дошло до модели: длиннее контекста — усечено стендом.
          ...(capped.cut ? { sentChars: capped.text.length } : {}),
        });
        messages.push({ role: 'tool', tool_name: name, content: capped.text });
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      exitReason = 'timeout';
    } else {
      exitReason = 'error';
      finalText = String(error?.message ?? error);
    }
  } finally {
    clearTimeout(timer);
    client.close();
    // Результат — когда журнал дописан: раннер и `npm run mcp:log` читают его сразу, а `process.exit`
    // в конце батча оборвал бы недописанный хвост.
    await new Promise((resolve) => transcript.end(resolve));
  }

  return {
    transcriptPath,
    toolCalls,
    usage,
    costUsd: 0,
    durationMs: Date.now() - startedAt,
    exitReason,
    finalText,
    harness,
    // Цикл свой, файловые инструменты ограничены рабочим каталогом: изоляция задана устройством.
    isolation: { ok: true, problems: [] },
  };
}
