/**
 * Прогон стенда одним диалогом: задание, ход модели, вызовы с ответами сервера, итог и проверки.
 *
 * Сырьё прогона лежит в `.tmp/mcp-runs/<батч>/<прогон>/` разными файлами: задание (`prompt.md`),
 * журнал агента (`transcript.jsonl` — сырой `stream-json` у Claude Code, свой журнал у Ollama, у
 * повтора без модели его нет), трасса сервера (`server-trace.jsonl`), последний ответ
 * (`final.txt`), вердикт (`verify.json`), снимок рабочего каталога агента (`workspace/`: `spec.md` и
 * прочее вне формы) и запись в `records.jsonl` батча. Читать прогон по ним
 * приходилось руками (ReFormer-qo9b.37). Здесь они сводятся в один Markdown.
 *
 * Вызов журнала и вызов трассы сходятся по отпечатку аргументов (`./digest.mjs` — та же функция, что
 * у сервера), затем по номеру вызова `call`, затем по имени и порядку: Claude Code зовёт инструменты
 * параллельно, и порядок прихода на сервер может не совпасть с порядком в транскрипте. Ответ сервера
 * берётся из журнала агента, а если журнал его не хранит (повтор, прежний журнал Ollama) — из полной
 * трассы.
 *
 * @module reformer-mcp/eval/lib/run-log
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checkStatus } from '../records/record.mjs';
import { argumentsDigest } from './digest.mjs';

/** Имя инструмента MCP у Claude Code: `mcp__<сервер>__<инструмент>`. */
const CLAUDE_MCP = /^mcp__.+?__(.+)$/;

/** Встроенный инструмент Claude Code, читающий ресурс MCP. */
const CLAUDE_READ_RESOURCE = 'ReadMcpResourceTool';

/** Инструмент чтения ресурса у агента Ollama. */
const OLLAMA_READ_RESOURCE = 'read_mcp_resource';

const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

/** Строки JSONL; испорченная строка пропускается — журнал оборванного прогона дописан не до конца. */
export function readJsonl(file) {
  const text = readText(file);
  if (text === null) return [];
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

/** Текст блоков ответа Claude: строка либо список блоков `{ type: 'text', text }`. */
function blocksText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content === undefined ? '' : JSON.stringify(content);
  return content
    .map((block) => (block?.type === 'text' ? block.text : JSON.stringify(block)))
    .join('\n');
}

/** Откуда вызов: инструмент MCP, ресурс MCP, файлы агента. */
function classifyClaude(name) {
  const mcp = CLAUDE_MCP.exec(name);
  if (mcp) return { source: 'mcp', name: mcp[1] };
  if (name === CLAUDE_READ_RESOURCE) return { source: 'resource', name };
  return { source: 'workspace', name };
}

/**
 * Диалог из `stream-json` Claude Code: сообщения ассистента по их id — шаги, `tool_use` — вызовы,
 * `tool_result` следующего сообщения пользователя — ответы.
 */
function fromClaude(events) {
  const steps = [];
  const calls = new Map();
  const meta = {};
  let current = null;
  for (const event of events) {
    if (event.type === 'system' && event.subtype === 'init') {
      meta.model = event.model;
      meta.mcpServers = event.mcp_servers;
    } else if (event.type === 'assistant') {
      const id = event.message?.id;
      if (current === null || current.id !== id) {
        current = { id, text: '', thinking: '', calls: [], notes: [] };
        steps.push(current);
      }
      for (const part of event.message?.content ?? []) {
        if (part.type === 'text') current.text += part.text;
        else if (part.type === 'thinking') current.thinking += part.thinking ?? '';
        else if (part.type === 'tool_use') {
          const kind = classifyClaude(part.name);
          const call = { id: part.id, ...kind, arguments: part.input ?? {} };
          current.calls.push(call);
          calls.set(part.id, call);
        }
      }
    } else if (event.type === 'user') {
      for (const part of event.message?.content ?? []) {
        if (part.type !== 'tool_result') continue;
        const call = calls.get(part.tool_use_id);
        if (call === undefined) continue;
        call.result = blocksText(part.content);
        call.ok = part.is_error !== true;
      }
    } else if (event.type === 'result') {
      meta.final = event.result;
      meta.costUsd = event.total_cost_usd;
      meta.turns = event.num_turns;
    }
  }
  return { agent: 'claude-code', steps, meta };
}

/**
 * Диалог из журнала агента Ollama: реплика ассистента — шаг, строки `tool` — его вызовы по порядку.
 * Прежний журнал (без текста ответов) читается тоже: ответ тогда берётся из трассы.
 */
function fromOllama(entries) {
  const steps = [];
  const meta = {};
  let pendingNotes = [];
  let current = null;
  for (const entry of entries) {
    if (entry.role === 'system') {
      meta.system = entry.content;
      meta.tools = entry.tools;
    } else if (entry.role === 'user' && !entry.nudge && meta.prompt === undefined) {
      meta.prompt = entry.content;
    } else if (entry.role === 'user') {
      pendingNotes.push(`Подсказка стенда: ${entry.content}`);
    } else if (entry.role === 'harness') {
      pendingNotes.push(`Стенд усёк старых ответов: ${entry.truncated}.`);
    } else if (entry.role === 'assistant') {
      current = {
        text: entry.content ?? '',
        thinking: entry.thinking ?? '',
        usage: entry.usage,
        calls: (entry.tool_calls ?? []).map((call) => ({
          name: call.function?.name,
          arguments: call.function?.arguments ?? {},
        })),
        notes: pendingNotes,
      };
      pendingNotes = [];
      steps.push(current);
    } else if (entry.role === 'tool' && current !== null) {
      const call =
        current.calls.find((c) => c.name === entry.name && c.ok === undefined) ??
        current.calls.find((c) => c.ok === undefined);
      if (call === undefined) continue;
      const source = entry.source ?? (entry.name === OLLAMA_READ_RESOURCE ? 'resource' : 'unknown');
      Object.assign(call, {
        source,
        ok: entry.ok,
        chars: entry.chars,
        ...(entry.arguments === undefined ? {} : { arguments: entry.arguments }),
        ...(entry.call === undefined ? {} : { call: entry.call }),
        ...(entry.argumentsDigest === undefined ? {} : { digest: entry.argumentsDigest }),
        ...(entry.content === undefined ? {} : { result: entry.content }),
        ...(entry.sentChars === undefined ? {} : { sentChars: entry.sentChars }),
      });
    }
  }
  // Итог — последняя реплика без вызовов: так его берёт и сам агент (`final.txt` пишет раннер).
  const last = steps.at(-1);
  if (last !== undefined && last.calls.length === 0) meta.final = last.text;
  return { agent: 'ollama', steps, meta };
}

/** Повтор без модели: вызовы — из трассы сервера, по одному на шаг. */
function fromTrace(trace) {
  const steps = trace
    .filter((entry) => entry.kind === 'tool')
    .map((entry) => ({
      text: '',
      thinking: '',
      notes: [],
      calls: [
        {
          source: 'mcp',
          name: entry.name,
          arguments: entry.arguments ?? entry.argumentsPreview,
          digest: entry.argumentsDigest,
          call: entry.call,
        },
      ],
    }));
  return { agent: null, steps, meta: {} };
}

/** Диалог из журнала агента: формат узнаётся по первой строке. */
export function dialogFromTranscript(entries, trace = []) {
  if (entries.length === 0) return fromTrace(trace);
  return entries.some((entry) => typeof entry.type === 'string' && !('role' in entry))
    ? fromClaude(entries)
    : fromOllama(entries);
}

/**
 * Свести вызовы диалога с трассой сервера. Ответ, которого журнал не хранит, берётся из трассы.
 *
 * @returns Строки трассы, которым в диалоге пары не нашлось, — по порядку прихода.
 */
export function joinTrace(steps, trace) {
  const used = new Set();
  const take = (predicate) => {
    const found = trace.find((entry) => !used.has(entry) && predicate(entry));
    if (found !== undefined) used.add(found);
    return found;
  };
  for (const call of steps.flatMap((step) => step.calls)) {
    let entry;
    // `unknown` — вызов прежнего журнала Ollama без поля `source`: им мог быть и инструмент MCP.
    if (call.source === 'mcp' || call.source === 'unknown') {
      const digest = call.digest ?? argumentsDigest(call.arguments);
      entry =
        take((e) => e.kind === 'tool' && e.name === call.name && e.argumentsDigest === digest) ??
        (call.call === undefined
          ? undefined
          : take((e) => e.kind === 'tool' && e.call === call.call)) ??
        take((e) => e.kind === 'tool' && e.name === call.name);
    } else if (call.source === 'resource') {
      const uri = call.arguments?.uri;
      entry = take((e) => e.kind === 'resource' && (uri === undefined || e.name === uri));
    }
    if (entry === undefined) continue;
    call.trace = entry;
    if (call.source === 'unknown' && entry.kind === 'tool') call.source = 'mcp';
    if (call.result === undefined && typeof entry.result === 'string') call.result = entry.result;
    if (call.ok === undefined) call.ok = !entry.isError;
  }
  return trace.filter((entry) => !used.has(entry));
}

/** Запись прогона из `records.jsonl` батча — по каталогу прогона. */
function recordOf(runDirectory) {
  const slug = path.basename(runDirectory);
  const records = readJsonl(path.join(path.dirname(runDirectory), 'records.jsonl'));
  return (
    records.find((record) => {
      const dir = record.artifacts?.runDir;
      return (
        (typeof dir === 'string' && dir.endsWith(`/${slug}`)) || record.runId?.endsWith(`.${slug}`)
      );
    }) ?? null
  );
}

/** Файлы снимка рабочего каталога агента (`workspace/`), пути — от каталога прогона. */
function workspaceFiles(runDirectory) {
  const root = path.join(runDirectory, 'workspace');
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(runDirectory, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    )
    .sort();
}

/** Всё о прогоне из его каталога. */
export function readRun(runDirectory) {
  const trace = readJsonl(path.join(runDirectory, 'server-trace.jsonl'));
  const transcript = readJsonl(path.join(runDirectory, 'transcript.jsonl'));
  const dialog = dialogFromTranscript(transcript, trace);
  const unmatched = joinTrace(dialog.steps, trace);
  const verifyText = readText(path.join(runDirectory, 'verify.json'));
  return {
    directory: runDirectory,
    record: recordOf(runDirectory),
    prompt: readText(path.join(runDirectory, 'prompt.md')) ?? dialog.meta.prompt ?? null,
    finalText: readText(path.join(runDirectory, 'final.txt')) ?? dialog.meta.final ?? null,
    verify: verifyText === null ? null : JSON.parse(verifyText),
    workspaceFiles: workspaceFiles(runDirectory),
    dialog,
    unmatched,
    traceCalls: trace.length,
  };
}

/** Ограда кода длиннее любой серии обратных кавычек внутри текста. */
function fenced(text, language = '') {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}

/** Текст не длиннее `max` знаков; `max <= 0` — целиком. */
function clip(text, max) {
  if (max <= 0 || text.length <= max) return text;
  return `${text.slice(0, max)}\n… [ещё ${text.length - max} симв.; --max 0 — целиком]`;
}

/** Текст цитатой: заголовки задания и ответа модели не ломают разделы диалога. */
const quote = (text) =>
  text
    .trimEnd()
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n');

const pretty = (value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

function details(summary, body, open = false) {
  return `<details${open ? ' open' : ''}><summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

const seconds = (ms) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)} с` : '—');

/** Шапка прогона: сценарий, агент, вердикт, время и токены — из записи. */
function header(run) {
  const { record } = run;
  const title = record?.runId ?? path.basename(run.directory);
  if (record === null) return [`# ${title}`, '', '_Записи прогона в records.jsonl батча нет._'];
  const scenario = record.scenario ?? {};
  const agent = record.agent ?? {};
  const usage = record.usage ?? {};
  const rows = [
    ['Сценарий', [scenario.id, scenario.target, scenario.level && `уровень ${scenario.level}`]],
    ['Агент', [agent.kind, agent.model]],
    ['Вердикт', [record.verdict, `счёт ${record.score ?? '—'}`, `выход ${record.exitReason}`]],
    ['Длительность', [seconds(record.durationMs)]],
    [
      'Токены и вызовы',
      [
        `вход ${usage.inputTokens ?? 0}`,
        `выход ${usage.outputTokens ?? 0}`,
        `шагов ${usage.turns ?? 0}`,
        `вызовов ${usage.toolCalls ?? 0} (ошибок ${usage.toolErrors ?? 0})`,
        usage.costUsd ? `≈ $${usage.costUsd.toFixed(2)}` : null,
      ],
    ],
  ];
  return [
    `# ${title}`,
    '',
    '| | |',
    '|---|---|',
    ...rows.map(([name, parts]) => `| ${name} | ${parts.filter(Boolean).join(' · ')} |`),
  ];
}

/** Строка вызова: имя, номер, длительность, размер ответа, ошибка. */
function callLine(call) {
  const trace = call.trace;
  const where = call.source === 'mcp' ? '' : ` _(${call.source})_`;
  const facts = [
    trace?.call === undefined ? null : `вызов #${trace.call}`,
    trace ? `${trace.durationMs} мс` : null,
    call.result === undefined ? null : `ответ ${call.result.length} симв.`,
    call.sentChars === undefined ? null : `до модели дошло ${call.sentChars}`,
    call.ok === false ? '**ошибка**' : null,
    trace?.protocolError ? `исключение: ${trace.protocolError}` : null,
  ].filter(Boolean);
  return `**→ ${call.name}**${where}${facts.length ? ` · ${facts.join(' · ')}` : ''}`;
}

/**
 * Markdown прогона.
 *
 * @param {{ max?: number }} options - `max` — предел знаков на ответ и аргументы; `0` — целиком.
 */
export function renderRun(run, options = {}) {
  const max = options.max ?? 4000;
  const { dialog } = run;
  const out = [...header(run), ''];

  // Проверка — статус либо пара `[статус, подробность]` (`checkStatus` записи прогона).
  const checks = Object.entries(run.record?.checks ?? run.verify?.checks ?? {});
  const failed = checks.filter(([, check]) => !['pass', 'skip'].includes(checkStatus(check)));
  if (failed.length > 0) {
    out.push(
      '**Проверки не прошли:**',
      ...failed.map(
        ([id, check]) =>
          `- \`${id}\`: ${Array.isArray(check) ? check.slice(1).join(' ') || check[0] : check}`
      ),
      ''
    );
  }
  const skipped = checks.filter(([, check]) => checkStatus(check) === 'skip').map(([id]) => id);
  if (skipped.length > 0)
    out.push(`Пропущены: ${skipped.map((id) => `\`${id}\``).join(', ')}.`, '');

  out.push('## Задание', '', run.prompt ? quote(run.prompt) : '_нет prompt.md_', '');
  if (run.workspaceFiles.length > 0) {
    const links = run.workspaceFiles.map(
      (file) => `[${file.slice('workspace/'.length)}](${encodeURI(file)})`
    );
    out.push(
      `Рабочий каталог агента (без \`form/\` — она в \`bundle/\`): ${links.join(' · ')}`,
      ''
    );
  }
  if (dialog.meta.system) {
    out.push(details('Системный промпт', fenced(dialog.meta.system)), '');
  }

  out.push('## Ход', '');
  if (dialog.agent === null) out.push('_Агент без модели: вызовы — из трассы сервера._', '');
  dialog.steps.forEach((step, index) => {
    const usage = step.usage
      ? ` · вход ${step.usage.inputTokens} / выход ${step.usage.outputTokens} токенов · ${seconds(step.usage.modelMs)}`
      : '';
    out.push(`### Шаг ${index + 1}${usage}`, '');
    for (const note of step.notes ?? []) out.push(`> ${note}`, '');
    if (step.thinking) out.push(details('Рассуждение', clip(step.thinking, max)), '');
    if (step.text) out.push(step.text.trim(), '');
    for (const call of step.calls) {
      out.push(callLine(call), '');
      out.push(details('Аргументы', fenced(clip(pretty(call.arguments), max), 'json')), '');
      if (call.result !== undefined) {
        out.push(details('Ответ', fenced(clip(call.result, max)), call.ok === false), '');
      }
    }
  });

  if (run.unmatched.length > 0) {
    out.push('## Вызовы сервера вне журнала агента', '');
    for (const entry of run.unmatched) {
      out.push(
        `- ${entry.ts?.slice(11, 19) ?? ''} ${entry.kind} \`${entry.name}\` · ${entry.durationMs} мс` +
          ` · ответ ${entry.resultChars} симв.${entry.isError ? ' · **ошибка**' : ''}`
      );
    }
    out.push('');
  }

  out.push('## Итог модели', '', run.finalText?.trim() ? quote(run.finalText) : '_пусто_', '');
  return `${out.join('\n').trimEnd()}\n`;
}
