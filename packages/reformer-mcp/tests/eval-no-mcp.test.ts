/**
 * Стенд «с MCP и без»: плечо без сервера проверяется наоборот (сервера быть не должно), а пакеты
 * `@reformer/*` в рабочем каталоге — ровно публикуемые файлы, как у потребителя из npm.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initProblems } from '../eval/agents/claude-code.mjs';
import { CONSUMER_PACKAGES, installConsumerPackages } from '../eval/scenarios/catalog.mjs';

describe('плечо без MCP', () => {
  const workspaceDirectory = resolve(tmpdir(), 'reformer-mcp-runs', 'run');
  const init = { cwd: workspaceDirectory, tools: ['Read', 'Write', 'Glob', 'Grep'] };

  it('без сервера — чисто; подключённый сервер в плече без MCP — нарушение', () => {
    expect(initProblems({ ...init, mcp_servers: [] }, { workspaceDirectory, mcp: false })).toEqual(
      []
    );
    expect(
      initProblems(
        { ...init, mcp_servers: [{ name: 'reformer', status: 'connected' }] },
        { workspaceDirectory, mcp: false }
      ).join('; ')
    ).toMatch(/без MCP/);
    // Плечо с MCP по-прежнему требует сервер.
    expect(initProblems({ ...init, mcp_servers: [] }, { workspaceDirectory }).join('; ')).toMatch(
      /сервер reformer: нет/
    );
  });

  it('пакеты в node_modules — публикуемые файлы: сборка, README, llms.txt, без исходников', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'no-mcp-packages-'));
    try {
      const installed = installConsumerPackages(workspace);
      expect(installed).toHaveLength(CONSUMER_PACKAGES.length);
      expect(installed).toContain('@reformer/core');
      const core = join(workspace, 'node_modules', '@reformer', 'core');
      expect(JSON.parse(readFileSync(join(core, 'package.json'), 'utf8')).name).toBe(
        '@reformer/core'
      );
      expect(existsSync(join(core, 'llms.txt'))).toBe(true);
      expect(existsSync(join(core, 'README.md'))).toBe(true);
      expect(existsSync(join(core, 'src'))).toBe(false);
      expect(existsSync(join(core, 'tests'))).toBe(false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
