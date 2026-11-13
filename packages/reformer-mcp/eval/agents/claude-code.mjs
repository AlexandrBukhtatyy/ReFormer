/**
 * Агент Claude Code: `claude -p` с единственным MCP-сервером и файловыми инструментами.
 *
 * Запускается по подписке (OAuth), поэтому `total_cost_usd` — оценка, а не списание; `auth` в
 * записи об этом предупреждает (`oauth-token`, `oauth`; `api-key` — уже списание). На macOS
 * обязателен токен `CLAUDE_CODE_OAUTH_TOKEN` из `claude setup-token` ({@link authMode}). Изоляция проверяется по факту: событие `system/init` называет каталог,
 * инструменты и серверы, а вызовы инструментов — куда агент на самом деле ходил. Нарушение делает
 * прогон недействительным, а не проваленным: это сломался прибор, а не форма.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { treeKillCommand } from '../../../../scripts/run-vitest-verdict.mjs';
import { repoRoot } from '../records/record.mjs';

export const kind = 'claude-code';

/**
 * Путь для сравнения: настоящий, без симлинков, в нижнем регистре. На macOS `os.tmpdir()` — это
 * `/var/folders/…`, а Claude Code называет каталог по-настоящему, `/private/var/folders/…`: без
 * разрешения симлинков изоляция считалась нарушенной во всех прогонах (батч `20261111T170113Z-5c48`).
 * Несуществующий путь — как есть.
 */
function normalize(value) {
  const resolved = path.resolve(String(value));
  let real = resolved;
  try {
    real = realpathSync.native(resolved);
  } catch {
    // Пути нет на диске (файл, который агент только собирается записать) — разрешаем родителя.
    try {
      real = path.join(realpathSync.native(path.dirname(resolved)), path.basename(resolved));
    } catch {
      real = resolved;
    }
  }
  return real.toLowerCase();
}

const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];
const MCP_PREFIX = 'mcp__reformer__';

/** Долгоживущий токен подписки (`claude setup-token`): вложенный claude не ходит в Keychain. */
export const TOKEN_ENV = 'CLAUDE_CODE_OAUTH_TOKEN';

/** Свой путь к CLI вместо поиска в PATH: например, свежий CLI, когда первым в PATH стоит старый. */
export const BIN_ENV = 'REFORMER_CLAUDE_BIN';

/**
 * Исполняемый файл `claude`: из {@link BIN_ENV} либо из PATH. На Windows npm кладёт в PATH обёртку
 * `.cmd`; запускать её пришлось бы через shell, поэтому берётся `.exe`, на который она указывает.
 */
function findClaude() {
  if (process.env[BIN_ENV]) return process.env[BIN_ENV];
  const lookup = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], {
    encoding: 'utf8',
  });
  const candidates = (lookup.stdout ?? '').split(/\r?\n/).filter(Boolean);
  const executable = candidates.find((file) => file.endsWith('.exe'));
  if (executable) return executable;
  const shim = candidates.find((file) => file.endsWith('.cmd'));
  if (shim) {
    const target = /"%dp0%\\([^"]+\.exe)"/.exec(readFileSync(shim, 'utf8'))?.[1];
    if (target) return path.join(path.dirname(shim), target);
    return null;
  }
  return candidates[0] ?? null;
}

/**
 * Флаги запуска, которых нет в старых версиях CLI. Без них `claude` падает на разборе аргументов
 * до события `init`, и каждый прогон батча становится недействительным за ноль долларов: так ушёл
 * батч `20261111T163322Z-0dd6` на Claude Code 1.0.83 из npm, первым стоявшем в PATH.
 */
const REQUIRED_FLAGS = [
  '--restricted',
  '--tools',
  '--permission-prompts',
  '--disable-slash-commands',
  '--no-session-persistence',
  '--max-budget-usd',
  '--strict-mcp-config',
];

/** Флаги, которых нет в справке CLI (`claude --help`). Чистая функция — проверяется тестом. */
export function missingFlags(helpText) {
  return REQUIRED_FLAGS.filter(
    (flag) => !new RegExp(`(^|\\s)${flag}(\\s|,|=|$)`, 'm').test(helpText)
  );
}

export async function preflight() {
  const claude = findClaude();
  if (!claude) return `В PATH нет claude (свой путь — ${BIN_ENV})`;
  const { problem } = authMode();
  if (problem) return problem;
  // stdin закрыт, время ограничено: старый CLI 1.0.83 на `--version` не отвечает минутами, а на
  // `--help` тратит около 10 с.
  const probe = (args, timeout) =>
    spawnSync(claude, args, {
      encoding: 'utf8',
      env: childEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });
  const help = probe(['--help'], 30_000);
  if (help.error) return `${claude} --help не ответил: ${help.error.message}`;
  const missing = missingFlags(`${help.stdout ?? ''}\n${help.stderr ?? ''}`);
  if (missing.length === 0) return null;
  const version = (probe(['--version'], 5_000).stdout ?? '').trim() || 'версия неизвестна';
  return (
    `${claude} (${version}) не знает ${missing.join(', ')}: обнови Claude Code или поставь ` +
    'свежий CLI первым в PATH'
  );
}

/**
 * Окружение вложенного claude: без признаков внешней сессии Claude Code — иначе вложенный запуск
 * отказывается работать. Токен подписки {@link TOKEN_ENV} остаётся: это не признак сессии, а
 * способ войти без Keychain. Чистая функция — проверяется тестом.
 */
export function childEnvironment(environment = process.env) {
  const result = { ...environment };
  for (const key of Object.keys(result)) {
    if (key === TOKEN_ENV) continue;
    if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE_')) delete result[key];
  }
  return result;
}

/**
 * Чем войдёт вложенный claude и можно ли так запускать батч. Без токена и ключа API каждый процесс
 * claude читает OAuth-токен из Keychain. На macOS это запрос пароля на каждый процесс, а прогоны
 * посреди батча получают «Not logged in» (батч `20261111T170113Z-5c48`: 8 из 13). Поэтому на macOS
 * такой запуск отклоняется до батча. Чистая функция — проверяется тестом.
 *
 * @returns `auth` — для записи прогона; `problem` — причина не начинать батч или `null`.
 */
export function authMode(environment = process.env, platform = process.platform) {
  if (environment[TOKEN_ENV]) return { auth: 'oauth-token', problem: null };
  if (environment.ANTHROPIC_API_KEY) return { auth: 'api-key', problem: null };
  if (platform !== 'darwin') return { auth: 'oauth', problem: null };
  return {
    auth: 'oauth',
    problem:
      `нет ${TOKEN_ENV}: без него каждый процесс claude читает токен из Keychain — macOS ` +
      'спрашивает пароль, а прогоны посреди батча получают «Not logged in». Токен выдаёт ' +
      `\`claude setup-token\`; запуск — \`${TOKEN_ENV}=<токен> npm run mcp:scenarios -- …\``,
  };
}

/** Способ входа для записи прогона: `oauth-token`, `api-key` или `oauth`. */
export const authKind = () => authMode().auth;

/** Проблемы изоляции по событию `system/init`. Чистая функция — проверяется тестом. */
export function initProblems(init, { workspaceDirectory }) {
  const problems = [];
  const root = normalize(repoRoot);
  if (normalize(init.cwd).startsWith(root + path.sep) || normalize(init.cwd) === root) {
    problems.push(`рабочий каталог внутри репозитория: ${init.cwd}`);
  }
  if (normalize(init.cwd) !== normalize(workspaceDirectory)) {
    problems.push(`рабочий каталог не тот: ${init.cwd}`);
  }
  const extraTools = (init.tools ?? []).filter(
    (tool) => !FILE_TOOLS.includes(tool) && !tool.startsWith(MCP_PREFIX)
  );
  // Инструменты работы с ресурсами MCP приходят вместе с сервером и за пределы сервера не ведут.
  const harmless = /^(ListMcpResourcesTool|ReadMcpResourceTool|ReadMcpResourceDirTool|ToolSearch)$/;
  const forbidden = extraTools.filter((tool) => !harmless.test(tool));
  if (forbidden.length > 0) problems.push(`лишние инструменты: ${forbidden.join(', ')}`);
  const servers = init.mcp_servers ?? [];
  const reformer = servers.find((server) => server.name === 'reformer');
  if (!reformer || reformer.status !== 'connected') {
    problems.push(`сервер reformer: ${reformer?.status ?? 'нет'}`);
  }
  const others = servers.filter((server) => server.name !== 'reformer');
  if (others.length > 0)
    problems.push(`чужие серверы: ${others.map((server) => server.name).join(', ')}`);
  return problems;
}

/** Файловый вызов, вышедший в репозиторий, — нарушение: агент должен знать только то, что дал сервер. */
function escapesWorkspace(toolInput, workspaceDirectory) {
  const target = toolInput?.file_path ?? toolInput?.path;
  if (typeof target !== 'string') return false;
  return normalize(path.resolve(workspaceDirectory, target)).startsWith(
    normalize(repoRoot) + path.sep
  );
}

/** @param {import('./types.mjs').AgentInput} input */
export function runAgent(input) {
  const startedAt = Date.now();
  const { limits, workspaceDirectory, runDirectory } = input;
  const mcpConfig = path.join(runDirectory, 'mcp.json');
  writeFileSync(
    mcpConfig,
    JSON.stringify({
      mcpServers: {
        reformer: {
          command: process.execPath,
          args: [input.serverPath],
          env: {
            REFORMER_TRACE_FILE: input.traceFile,
            // Полная трасса: аргументы и ответы целиком — для разбора прогона (`npm run mcp:log`).
            REFORMER_TRACE_FULL: '1',
            REFORMER_ISSUE_REPORTS_DIR: path.join(runDirectory, 'issue-reports'),
            // Агент вне репозитория, а типы формы form_build проверяет с настоящими пакетами.
            REFORMER_TYPECHECK_ROOT: repoRoot,
            ...input.approach.serverEnv,
          },
        },
      },
    })
  );

  const disallowed = (input.approach.withoutTools ?? []).map((tool) => `${MCP_PREFIX}${tool}`);
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    ...(input.model ? ['--model', input.model] : []),
    ...(input.settings?.effort ? ['--effort', input.settings.effort] : []),
    '--mcp-config',
    mcpConfig,
    '--strict-mcp-config',
    '--restricted',
    '--tools',
    FILE_TOOLS.join(','),
    '--allowedTools',
    [`${MCP_PREFIX}*`, ...FILE_TOOLS].join(','),
    ...(disallowed.length ? ['--disallowedTools', disallowed.join(',')] : []),
    '--permission-mode',
    'acceptEdits',
    '--permission-prompts',
    'none',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--max-budget-usd',
    String(limits.maxUsd),
  ];

  const transcriptPath = path.join(runDirectory, 'transcript.jsonl');
  const transcript = createWriteStream(transcriptPath);
  const toolCalls = [];
  const callsById = new Map();
  const problems = [];
  let usage = null;
  let costUsd = 0;
  let exitReason = 'error';
  let finalText = '';
  let sawInit = false;

  const handleEvent = (event) => {
    if (event.type === 'system' && event.subtype === 'init') {
      sawInit = true;
      problems.push(...initProblems(event, { workspaceDirectory }));
    } else if (event.type === 'assistant') {
      for (const part of event.message?.content ?? []) {
        if (part.type !== 'tool_use') continue;
        const call = { name: part.name.replace(MCP_PREFIX, ''), ok: true };
        toolCalls.push(call);
        callsById.set(part.id, call);
        if (escapesWorkspace(part.input, workspaceDirectory)) {
          problems.push(
            `${part.name} вышел в репозиторий: ${part.input.file_path ?? part.input.path}`
          );
        }
      }
    } else if (event.type === 'user') {
      for (const part of event.message?.content ?? []) {
        if (part.type === 'tool_result' && part.is_error && callsById.has(part.tool_use_id)) {
          callsById.get(part.tool_use_id).ok = false;
        }
      }
    } else if (event.type === 'result') {
      costUsd = event.total_cost_usd ?? 0;
      finalText = String(event.result ?? '').slice(0, 2000);
      // `success` с `is_error` — сбой канала, а не работа модели: так приходит «Not logged in»
      // (ни одного хода, ноль токенов). Раннер считает такой прогон недействительным.
      exitReason =
        event.is_error === true && event.subtype === 'success'
          ? 'error'
          : event.subtype === 'success'
            ? 'completed'
            : /budget/i.test(event.subtype ?? '')
              ? 'budget'
              : /turns/i.test(event.subtype ?? '')
                ? 'maxSteps'
                : 'error';
      usage = {
        inputTokens: event.usage?.input_tokens ?? 0,
        outputTokens: event.usage?.output_tokens ?? 0,
        cacheReadTokens: event.usage?.cache_read_input_tokens ?? 0,
        cacheCreationTokens: event.usage?.cache_creation_input_tokens ?? 0,
        costUsd,
        turns: event.num_turns ?? 0,
        modelMs: event.duration_api_ms ?? 0,
      };
    }
  };

  return new Promise((resolve) => {
    const child = spawn(findClaude(), args, {
      cwd: workspaceDirectory,
      env: childEnvironment(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      transcript.write(chunk);
      buffer += chunk.toString('utf8');
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          handleEvent(JSON.parse(line));
        } catch {
          // Не JSON — диагностика CLI, остаётся в транскрипте.
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-2000);
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      // `child.kill()` на Windows не трогает дерево: сервер MCP остался бы сиротой.
      const kill = treeKillCommand(child.pid);
      if (kill) spawnSync(kill[0], kill[1], { stdio: 'ignore' });
      else child.kill('SIGKILL');
    }, limits.timeoutMs);

    // Результат — когда журнал дописан: `process.exit` в конце батча оборвал бы недописанный хвост.
    child.on('error', (error) => {
      clearTimeout(timer);
      transcript.end(() => resolve(finish(`запуск claude: ${error.message}`)));
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (timedOut) exitReason = 'timeout';
      transcript.end(() => resolve(finish(finalText || stderr)));
    });
    child.stdin.end(input.prompt);

    function finish(text) {
      if (!sawInit) problems.push(`нет события init: ${stderr.slice(0, 200)}`);
      return {
        transcriptPath,
        toolCalls,
        usage,
        costUsd,
        durationMs: Date.now() - startedAt,
        exitReason,
        finalText: text,
        isolation: { ok: problems.length === 0, problems },
      };
    }
  });
}
