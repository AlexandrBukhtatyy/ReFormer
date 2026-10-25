/**
 * Серверы проекта: каталоги `.ui_builder/mcp/*` и записи `.mcp.json` — одним списком.
 *
 * Читается только конфигурация — ни один воркер здесь не запускается и ни одно соединение не
 * открывается: обнаружение идёт на активации и на смене проекта, а платить за сервер положено
 * только тому, кто к нему обратился (`../connection/supervisor`).
 *
 * ## Одно имя — два источника
 *
 * Побеждает бандл. Типичный случай — `reformer`: в `.mcp.json` он stdio-сервер для Claude Code,
 * в `.ui_builder/mcp/reformer/` — тот же сервер для браузера. Запись `.mcp.json` при этом не
 * исчезает молча, а уходит в замечания: человек должен видеть, что ассистент её не берёт.
 *
 * @module plugins/forms/mcp/config/discover
 */

import { BUNDLED_SERVERS_DIR, MCP_JSON, SERVER_SCRIPT, SERVER_SETTINGS } from '../contract';
import type { McpHost } from '../host';
import { parseMcpJson } from './mcp-json';
import { parseServerJson } from './server-json';
import { isServerName, type BundleServerSpec, type ServerSpec } from './types';

export interface DiscoveredServers {
  /** По имени, без повторов; порядок — бандлы, затем записи `.mcp.json`, каждые по имени. */
  readonly servers: readonly ServerSpec[];
  /** Замечания к источникам целиком. */
  readonly problems: readonly string[];
}

const NONE: DiscoveredServers = { servers: [], problems: [] };

/** Прочитать серверы открытого проекта. Без проекта — пусто. */
export async function discoverServers(host: McpHost): Promise<DiscoveredServers> {
  const root = host.projectRoot();
  if (root === null) return NONE;

  const [bundles, remote] = await Promise.all([
    discoverBundles(host, host.resolve(root, ...BUNDLED_SERVERS_DIR)),
    host
      .readText(host.resolve(root, MCP_JSON))
      .catch(() => null)
      .then(parseMcpJson),
  ]);

  const problems = [...remote.problems];
  const taken = new Set(bundles.map((spec) => spec.name));
  const fromMcpJson = remote.servers
    .filter((spec) => {
      if (!taken.has(spec.name)) return true;
      problems.push(`«${spec.name}» из .mcp.json замещён сервером .ui_builder/mcp/${spec.name}`);
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { servers: [...bundles, ...fromMcpJson], problems };
}

async function discoverBundles(host: McpHost, dir: string): Promise<BundleServerSpec[]> {
  const entries = await host.list(dir).catch(() => []);
  const directories = entries
    .filter((entry) => entry.kind === 'directory' && isServerName(entry.name))
    // По имени: порядок листинга источника не обещан, а список серверов виден модели.
    .sort((a, b) => a.name.localeCompare(b.name));

  return Promise.all(
    directories.map(async (entry): Promise<BundleServerSpec> => {
      const files = await host.list(entry.id).catch(() => []);
      const script = files.find((file) => file.kind === 'file' && file.name === SERVER_SCRIPT);
      const settingsFile = files.find(
        (file) => file.kind === 'file' && file.name === SERVER_SETTINGS
      );
      const settings = parseServerJson(
        settingsFile === undefined ? null : await host.readText(settingsFile.id).catch(() => null)
      );
      return {
        kind: 'bundle',
        name: entry.name,
        dir: entry.id,
        script: script?.id ?? null,
        ...(settings.idleSeconds === undefined ? {} : { idleSeconds: settings.idleSeconds }),
        notes: settings.notes,
      };
    })
  );
}
