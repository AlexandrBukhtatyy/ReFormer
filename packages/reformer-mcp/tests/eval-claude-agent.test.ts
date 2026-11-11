/**
 * Агент Claude Code без Keychain (ReFormer-qo9b.39): токен подписки доходит до вложенного claude,
 * на macOS без него батч не начинается, а «Not logged in» — сбой канала, а не проваленная форма.
 *
 * Сквозная проверка идёт на поддельном `claude` (`REFORMER_CLAUDE_BIN`): настоящий CLI потратил бы
 * подписку и полез бы в Keychain — ровно то, от чего эта правка уходит.
 */

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authMode,
  BIN_ENV,
  childEnvironment,
  runAgent,
  TOKEN_ENV,
} from '../eval/agents/claude-code.mjs';
import { precondition } from './support/preconditions';

describe('окружение вложенного claude', () => {
  it('признаки внешней сессии уходят, токен подписки остаётся', () => {
    const environment = childEnvironment({
      PATH: '/usr/bin',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'claude-vscode',
      CLAUDE_CODE_CHILD_SESSION: '1',
      [TOKEN_ENV]: 'token',
    });
    expect(environment).toEqual({ PATH: '/usr/bin', [TOKEN_ENV]: 'token' });
  });

  it('macOS без токена и ключа — отказ до батча с тем, как получить токен', () => {
    const { auth, problem } = authMode({}, 'darwin');
    expect(auth).toBe('oauth');
    expect(problem).toContain('claude setup-token');
    expect(problem).toContain(`${TOKEN_ENV}=<токен>`);
  });

  it('токен, ключ API и не-macOS — без отказа; запись называет способ входа', () => {
    expect(authMode({ [TOKEN_ENV]: 't' }, 'darwin')).toEqual({
      auth: 'oauth-token',
      problem: null,
    });
    expect(authMode({ ANTHROPIC_API_KEY: 'k' }, 'darwin')).toEqual({
      auth: 'api-key',
      problem: null,
    });
    expect(authMode({}, 'linux')).toEqual({ auth: 'oauth', problem: null });
    expect(authMode({}, 'win32')).toEqual({ auth: 'oauth', problem: null });
  });
});

const posix = precondition(
  'исполняемый скрипт с shebang',
  process.platform !== 'win32',
  'поддельный claude запускается как скрипт: на Windows нужен .exe'
);

/** Поддельный claude: событие init и итог «Not logged in», как у CLI без логина. */
const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs');
process.stdin.resume();
process.stdin.on('end', () => {
  fs.writeFileSync('env-check.json', JSON.stringify({
    token: process.env.${TOKEN_ENV} ?? null,
    entrypoint: process.env.CLAUDE_CODE_ENTRYPOINT ?? null,
    claudecode: process.env.CLAUDECODE ?? null,
  }));
  const emit = (event) => process.stdout.write(JSON.stringify(event) + '\\n');
  emit({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Read', 'Write'],
    mcp_servers: [{ name: 'reformer', status: 'connected' }] });
  emit({ type: 'result', subtype: 'success', is_error: true,
    result: 'Not logged in · Please run /login', total_cost_usd: 0, num_turns: 1, usage: {} });
});
`;

describe.runIf(posix)('агент Claude Code на поддельном CLI', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'claude-agent-'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it('токен доходит до claude, «Not logged in» — сбой канала, а не завершённая работа', async () => {
    const fake = path.join(root, 'claude');
    writeFileSync(fake, FAKE_CLAUDE);
    chmodSync(fake, 0o755);
    const workspaceDirectory = path.join(root, 'workspace');
    const runDirectory = path.join(root, 'run');
    mkdirSync(workspaceDirectory);
    mkdirSync(runDirectory);
    vi.stubEnv(BIN_ENV, fake);
    vi.stubEnv(TOKEN_ENV, 'test-token');
    vi.stubEnv('CLAUDE_CODE_ENTRYPOINT', 'claude-vscode');
    vi.stubEnv('CLAUDECODE', '1');

    const result = await runAgent({
      scenario: { id: 'L1-test' },
      target: 'core',
      workspaceDirectory,
      runDirectory,
      prompt: 'Сделай форму.',
      model: 'sonnet',
      approach: { id: 'bare' },
      serverPath: path.join(root, 'server.js'),
      traceFile: path.join(runDirectory, 'server-trace.jsonl'),
      limits: { timeoutMs: 30_000, maxUsd: 1, maxSteps: 10 },
    });

    expect(result.exitReason).toBe('error');
    expect(result.finalText).toBe('Not logged in · Please run /login');
    // Изоляция цела: каталог из init совпал с рабочим, хотя tmpdir на macOS — через симлинк.
    expect(result.isolation).toEqual({ ok: true, problems: [] });
    const seen = JSON.parse(readFileSync(path.join(workspaceDirectory, 'env-check.json'), 'utf8'));
    expect(seen).toEqual({ token: 'test-token', entrypoint: null, claudecode: null });
  });
});
