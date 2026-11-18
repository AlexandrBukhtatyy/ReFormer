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
 *
 * Ход прогона — через `onProgress`: строка на шаг ({@link stepLine}) и пульс, пока модель отвечает
 * дольше минуты ({@link waitLine}). Одна Ollama — один батч ({@link claimOllama}).
 *
 * Сырого вывода модели в ответе Ollama нет: у моделей со своим шаблоном (qwen3.5: `RENDERER` и
 * `PARSER` в Modelfile) вызовы разбирает сама Ollama и отдаёт уже `tool_calls`. Поэтому ошибки
 * формата вызова видны по косвенным признакам (ReFormer-mhsh.8):
 * - вызов без аргументов при обязательных параметрах ({@link isEmptyCall}) — помечается в журнале,
 *   в строке шага (`∅`) и в счётчике `harness.emptyCalls`. Это ошибка модели, а не разбора: такой
 *   шаг у qwen3.5:4b — ровно 13 токенов, то есть пустая обёртка вызова без кода;
 * - ответ, который Ollama не разобрала ({@link isToolCallParseError}: «XML syntax error», 500 на весь
 *   запрос) — реплика модели потеряна. Модель получает сообщение об ошибке и продолжает, шаг
 *   засчитан, счётчик `harness.unparsedCalls`. Прежде такой прогон становился недействительным и
 *   выпадал из статистики, хотя это та же ошибка формата вызова со стороны модели.
 */

import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { McpClient } from '../lib/client.mjs';
import { argumentsDigest } from '../lib/digest.mjs';
import { repoRoot, runsDirectory } from '../records/record.mjs';
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

/**
 * Проверка до батча: сервер Ollama отвечает, модель загружена, и на этой Ollama не идёт другой батч
 * ({@link claimOllama}).
 *
 * @param {string} model
 * @param {{ sharedOllama?: boolean }} [options] - `sharedOllama` — делить Ollama с другим батчем
 *   осознанно (`--shared-ollama`): время шагов такого батча не сравнимо с прочими
 */
export async function preflight(model, { sharedOllama = false } = {}) {
  const response = await fetch(`${BASE_URL}/api/tags`).catch(() => null);
  if (!response?.ok) return `Ollama не отвечает на ${BASE_URL}`;
  const { models } = await response.json();
  if (!models.some((item) => item.name === model)) return `В Ollama нет модели ${model}`;
  if (sharedOllama) return null;
  const claim = claimOllama();
  if (claim.ok) return null;
  const { pid, command } = claim.holder;
  // Местное время — как в строках прогресса и в логе Ollama.
  const startedAt = new Date(claim.holder.startedAt).toLocaleString('ru-RU');
  return (
    `Ollama на ${BASE_URL} уже занята другим батчем (pid ${pid}, с ${startedAt}${command ? `: ${command}` : ''}). ` +
    'Ollama отвечает на запросы по одному: шаги двух батчей ждут друг друга, и их время не сравнимо. ' +
    'Дождитесь того батча или запустите с --shared-ollama.'
  );
}

/** Процесс жив: сигнал 0 ничего не шлёт, только проверяет. `EPERM` — жив, но чужой. */
function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

/** Файл занятости Ollama: свой на каждый адрес, чтобы батчи на разных серверах не мешали друг другу. */
export function ollamaLockFile(baseUrl = BASE_URL, directory = runsDirectory) {
  const host = new URL(baseUrl).host.replace(/[^\w.-]+/g, '-');
  return path.join(directory, `.ollama-${host}.lock`);
}

let releaseRegistered = false;

/**
 * Занять Ollama на время батча (ReFormer-qo9b.41).
 *
 * Ollama отвечает на запросы по одному. Второй батч на той же Ollama делит с первым очередь: шаг
 * ждёт чужой, префикс-кэш вытесняется (батч 20261112T050751Z-bc87: первый шаг — 78 с вместо 10–15),
 * и время шагов и таймауты обоих батчей врут. Владельца хранит файл; владелец с мёртвым процессом
 * (снятый Ctrl+C или kill батч не убирает файл) не мешает. Свой файл процесс убирает на выходе.
 *
 * @param {{ lockFile?: string, pid?: number, isAlive?: (pid: number) => boolean, now?: Date,
 *   command?: string }} [options] - для тестов
 * @returns {{ ok: true } | { ok: false, holder: { pid: number, startedAt: string, command?: string } }}
 */
export function claimOllama({
  lockFile = ollamaLockFile(),
  pid = process.pid,
  isAlive = processAlive,
  now = new Date(),
  command = process.argv.slice(2).join(' '),
} = {}) {
  let holder = null;
  try {
    holder = JSON.parse(readFileSync(lockFile, 'utf8'));
  } catch {
    // Файла нет или он испорчен — Ollama свободна.
  }
  if (holder && holder.pid !== pid && Number.isInteger(holder.pid) && isAlive(holder.pid)) {
    return { ok: false, holder };
  }
  mkdirSync(path.dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, JSON.stringify({ pid, startedAt: now.toISOString(), command }));
  if (pid === process.pid && !releaseRegistered) {
    releaseRegistered = true;
    process.once('exit', () => releaseOllama({ lockFile, pid }));
  }
  return { ok: true };
}

/** Убрать файл занятости, если он ещё свой. */
export function releaseOllama({ lockFile = ollamaLockFile(), pid = process.pid } = {}) {
  try {
    if (JSON.parse(readFileSync(lockFile, 'utf8')).pid === pid) rmSync(lockFile, { force: true });
  } catch {
    // Файла уже нет.
  }
}

/** Часы для строки прогресса: местное время, как в логе Ollama. */
const clock = (at) => at.toTimeString().slice(0, 8);

/** Пульс ожидания ответа модели: строка раз в столько миллисекунд. */
export const WAIT_PULSE_MS = 60_000;

/**
 * Строка о сделанном шаге (ReFormer-qo9b.41). Раннер пишет строку только в конце ячейки, а шаг малой
 * модели идёт до двух минут: батч 20261112T050352Z-2bb5 сочли зависшим после ошибки `validate_form`,
 * хотя модель сделала ещё четыре шага — файловыми инструментами, которых нет в трассе сервера.
 * `∅` — вызов без аргументов ({@link isEmptyCall}).
 *
 * @param {{ at: Date, slug: string, step: number, modelMs: number,
 *   calls: Array<{ name: string, ok: boolean, empty?: boolean }> }} entry
 */
export function stepLine({ at, slug, step, modelMs, calls }) {
  const tools =
    calls.length > 0
      ? calls
          .map((call) => `${call.name}${call.empty ? ' ∅' : ''}${call.ok ? '' : ' ✗'}`)
          .join(', ')
      : 'ответ без вызова';
  return `  ${clock(at)} · ${slug} · шаг ${step} · модель ${Math.round(modelMs / 1000)} с · ${tools}`;
}

/** Строка пульса: модель ещё отвечает — прогон жив. */
export function waitLine({ at, slug, step, waitedMs }) {
  return `  ${clock(at)} · ${slug} · шаг ${step} · ждёт модель ${Math.round(waitedMs / 1000)} с`;
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
          else
            reject(
              Object.assign(new Error(`Ollama ${response.statusCode}: ${text.slice(0, 300)}`), {
                status: response.statusCode,
                body: text,
              })
            );
        });
      }
    );
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });
}

/**
 * Ошибка разбора вызова инструмента в ответе модели. Ollama разбирает вызовы qwen3.5 как XML и на
 * ошибке отвечает 500 на весь запрос: «XML syntax error on line 3: element <function> closed by
 * </parameter>» (батч 20261117T091909Z-934c, order-create.renderer-react).
 */
const TOOL_CALL_PARSE_ERROR =
  /XML syntax error|pars\w*[^"]{0,40}tool[ _-]?call|tool[ _-]?call[^"]{0,40}pars/i;

/**
 * Ollama не разобрала вызов в ответе модели — ошибка формата со стороны модели, а не сбой канала.
 * Нехватка памяти, переполнение контекста и прочие 500 сюда не входят: они остаются сбоем канала.
 */
export function isToolCallParseError(error) {
  return error?.status === 500 && TOOL_CALL_PARSE_ERROR.test(String(error.body ?? error.message));
}

/**
 * Вызов без аргументов у инструмента с обязательными параметрами. Модель отдала пустую обёртку
 * вызова: у qwen3.5:4b такой шаг — 13 токенов (батч 20261117T091909Z-934c: 41 вызов `execute` с `{}`,
 * в registration-create.renderer-react — все 30 шагов).
 */
export function isEmptyCall(argumentsValue, inputSchema) {
  const empty =
    argumentsValue === null ||
    argumentsValue === undefined ||
    (typeof argumentsValue === 'object' && Object.keys(argumentsValue).length === 0);
  return empty && (inputSchema?.required?.length ?? 0) > 0;
}

/** Сообщение модели, когда Ollama не разобрала её вызов: реплика потеряна, шаг засчитан. */
export function unparsedNotice(error) {
  let reason = String(error?.body ?? error?.message ?? '');
  try {
    reason = JSON.parse(reason).error ?? reason;
  } catch {
    // Тело не JSON — берём как есть.
  }
  return `Вызов инструмента в твоём ответе не разобран (${reason.slice(0, 200)}), ответ потерян. Вызови инструмент ещё раз: имя и аргументы — по его схеме.`;
}

const toFunction = (tool) => ({
  type: 'function',
  function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
});

/**
 * Ответы, которые модель держит целиком: грамматика и диагностика `form_build`, сводка `plan_form`,
 * план `form_start` профиля guided (он приходит один раз; ответы `form_edit` повторяют следующий шаг
 * сами, их старые копии усекаются как обычно). Усечённую грамматику модель дописывала бы по памяти, и замер судил бы стенд, а не сервер
 * (ReFormer-qo9b.31: прогон qwen L1-feedback, 135 усечений при контексте 32k). Их длина попадает в
 * запись прогона.
 */
export const KEEP_WHOLE_TOOLS = new Set(['plan_form', 'form_build', 'form_start']);

/**
 * Code Mode: скрипт, вызвавший сборку или черновик intent, несёт в ответе их текст. В связке с
 * guided сборку делает и formEdit, а план — formStart.
 */
const BUILD_IN_SCRIPT =
  /reformer\s*\.\s*(formBuild|planForm|formStart|formEdit|form)\s*\(|\.\s*(save|build|confirm)\s*\(/;

/**
 * Держать ли ответ целиком. В Code Mode грамматика и диагностика `form_build` приходят ответом
 * `run_script` — держим его на тех же правах, иначе режимы сравнивались бы при разных условиях стенда.
 */
export function keepsWhole(name, args) {
  if (KEEP_WHOLE_TOOLS.has(name)) return true;
  return (
    (name === 'run_script' || name === 'execute') &&
    typeof args?.code === 'string' &&
    BUILD_IN_SCRIPT.test(args.code)
  );
}

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

/**
 * Усечь старые ответы инструментов; возвращает число усечённых за этот шаг.
 *
 * @param {Array<object>} messages
 * @param {WeakSet<object>} [kept] - ответы, которые держатся целиком по {@link keepsWhole}
 */
export function truncateOldResults(messages, kept = new WeakSet()) {
  const results = messages.filter(
    (message) =>
      message.role === 'tool' && !KEEP_WHOLE_TOOLS.has(message.tool_name) && !kept.has(message)
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
      ...input.approach.serverEnv,
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
    emptyCalls: 0,
    unparsedCalls: 0,
  };
  const cap = responseCap(settings.numCtx ?? 32768);
  const slug = path.basename(input.runDirectory);
  const progress = input.onProgress ?? null;
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
    const schemaOf = new Map(tools.map((tool) => [tool.name, tool.inputSchema]));

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

    /** Ответы, которые держатся целиком ({@link keepsWhole}). */
    const kept = new WeakSet();
    for (let step = 0; step < limits.maxSteps; step++) {
      const truncated = truncateOldResults(messages, kept);
      harness.truncations += truncated;
      if (truncated > 0) log({ step, role: 'harness', truncated });
      // Ответ модели ждётся минутами: пульс показывает, что прогон жив, а не завис.
      const waitStarted = Date.now();
      const pulse = progress
        ? setInterval(
            () =>
              progress(
                waitLine({ at: new Date(), slug, step, waitedMs: Date.now() - waitStarted })
              ),
            WAIT_PULSE_MS
          )
        : null;
      let reply;
      try {
        reply = await postChat(
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
      } catch (error) {
        if (controller.signal.aborted || !isToolCallParseError(error)) throw error;
        // Ollama не разобрала вызов в ответе модели: реплика потеряна, но шаг сделан. Модель узнаёт
        // об ошибке и продолжает — как после ошибки инструмента; предел шагов ограничивает повторы.
        const modelMs = Date.now() - waitStarted;
        usage.turns++;
        usage.modelMs += modelMs;
        harness.unparsedCalls++;
        log({ step, role: 'harness', unparsed: String(error.body ?? error.message), modelMs });
        const notice = unparsedNotice(error);
        messages.push({ role: 'user', content: notice });
        log({ step, role: 'user', content: notice, nudge: true });
        progress?.(
          stepLine({
            at: new Date(),
            slug,
            step,
            modelMs,
            calls: [{ name: 'вызов не разобран', ok: false }],
          })
        );
        continue;
      } finally {
        if (pulse) clearInterval(pulse);
      }
      const modelMs = Math.round((reply.total_duration ?? 0) / 1e6);
      usage.turns++;
      usage.inputTokens += reply.prompt_eval_count ?? 0;
      usage.outputTokens += reply.eval_count ?? 0;
      usage.modelMs += modelMs;
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
          modelMs,
        },
      });
      messages.push(message);

      const calls = message.tool_calls ?? [];
      /** Вызовы этого шага — для строки прогресса. */
      const stepCalls = [];
      if (calls.length === 0) {
        progress?.(stepLine({ at: new Date(), slug, step, modelMs, calls: stepCalls }));
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
        const empty = isEmptyCall(argumentsValue, schemaOf.get(name));
        if (empty) harness.emptyCalls++;
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
        stepCalls.push({ name, ok: result.ok, ...(empty ? { empty: true } : {}) });
        const whole = keepsWhole(name, argumentsValue);
        if (whole) {
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
          ...(empty ? { emptyArguments: true } : {}),
          ok: result.ok,
          chars: result.text.length,
          content: result.text,
          // Что из ответа дошло до модели: длиннее контекста — усечено стендом.
          ...(capped.cut ? { sentChars: capped.text.length } : {}),
        });
        const toolMessage = { role: 'tool', tool_name: name, content: capped.text };
        if (whole) kept.add(toolMessage);
        messages.push(toolMessage);
      }
      progress?.(stepLine({ at: new Date(), slug, step, modelMs, calls: stepCalls }));
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
