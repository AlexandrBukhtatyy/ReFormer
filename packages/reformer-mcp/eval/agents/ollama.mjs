/**
 * Агент на локальной модели через Ollama: свой цикл вызовов инструментов.
 *
 * Нативный `POST /api/chat` без AI SDK: в корне репозитория лежит `ai@5`, у конструктора — `ai@7`, и
 * импорт отсюда разрешился бы не в ту версию. Токены — точные, из ответа Ollama.
 *
 * Контекст модели ограничен, поэтому старые ответы инструментов усекаются — кроме ответов генератора
 * ({@link KEEP_WHOLE_TOOLS}). Это вмешательство прибора: число усечений и длина ответов генератора
 * попадают в запись прогона.
 */

import { createWriteStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { McpClient } from '../lib/client.mjs';
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
 * Ответы, которые модель переносит в файлы целиком: бандл `generate_form`, intent `plan_form`,
 * грамматика `form_build`. Усечённый бандл модель дописывала бы по памяти, и замер судил бы стенд, а
 * не сервер (ReFormer-qo9b.31: прогон qwen L1-feedback, 135 усечений при контексте 32k). Их длина
 * попадает в запись прогона: ответ длиннее контекста модели виден там, а не теряется молча.
 */
export const KEEP_WHOLE_TOOLS = new Set(['generate_form', 'plan_form', 'form_build']);

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
      // Как у claude-code: агент вне репозитория, а типы формы form_build проверяет с настоящими
      // пакетами. Без этого проверка типов недоступна, и запасная проверка импортов на снимке
      // сервера без соседних пакетов отвергает собственный код генератора (батч f7d3).
      REFORMER_TYPECHECK_ROOT: repoRoot,
    },
    cwd: input.workspaceDirectory,
  });
  const toolCalls = [];
  const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0, turns: 0, modelMs: 0 };
  const harness = { truncations: 0, textualCalls: 0, keptWhole: 0, keptWholeMaxChars: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  let exitReason = 'maxSteps';
  let finalText = '';

  try {
    await client.initialize();
    const listed = (await client.request('tools/list', {})).result?.tools ?? [];
    const withoutTools = new Set(input.approach.withoutTools ?? []);
    const mcpTools = listed.filter((tool) => !withoutTools.has(tool.name));
    const mcpNames = new Set(mcpTools.map((tool) => tool.name));
    const tools = [...mcpTools, READ_RESOURCE_TOOL, ...WORKSPACE_TOOLS];
    const toolNames = tools.map((tool) => tool.name);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: input.prompt },
    ];
    let nudged = false;

    for (let step = 0; step < limits.maxSteps; step++) {
      harness.truncations += truncateOldResults(messages);
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
      log({ step, role: 'assistant', content: message.content, tool_calls: message.tool_calls });
      messages.push(message);

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        const textual = findTextualCall(message.content ?? '', toolNames);
        if (textual) harness.textualCalls++;
        if (textual && !nudged && settings.nudges !== false) {
          // Модель написала вызов текстом и считает работу сделанной. Один раз подсказываем: это
          // свойство модели, а не сервера, но без подсказки сценарий мерил бы только его.
          nudged = true;
          messages.push({
            role: 'user',
            content: `Ты написал вызов ${textual} текстом, и он не выполнен. Вызови инструмент по-настоящему.`,
          });
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
        if (mcpNames.has(name)) {
          const reply_ = await client.callTool(name, argumentsValue);
          result = {
            ok: !reply_.error && reply_.result?.isError !== true,
            text: reply_.text || JSON.stringify(reply_.error),
          };
        } else if (name === READ_RESOURCE_TOOL.name) {
          const reply_ = await client.readResource(argumentsValue.uri);
          result = { ok: !reply_.error, text: reply_.text || JSON.stringify(reply_.error) };
        } else if (WORKSPACE_TOOLS.some((tool) => tool.name === name)) {
          result = runWorkspaceTool(input.workspaceDirectory, name, argumentsValue);
        } else {
          result = { ok: false, text: `Неизвестный инструмент: ${name}` };
        }
        toolCalls.push({ name, ok: result.ok });
        log({ step, role: 'tool', name, ok: result.ok, chars: result.text.length });
        if (KEEP_WHOLE_TOOLS.has(name)) {
          harness.keptWhole++;
          harness.keptWholeMaxChars = Math.max(harness.keptWholeMaxChars, result.text.length);
        }
        messages.push({ role: 'tool', tool_name: name, content: result.text });
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
    transcript.end();
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
