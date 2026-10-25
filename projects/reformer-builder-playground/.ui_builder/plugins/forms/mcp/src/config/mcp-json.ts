/**
 * `.mcp.json` в корне проекта — удалённые MCP-серверы, тот же формат, что у Claude Code:
 *
 * ```json
 * { "mcpServers": { "<имя>": { "type": "http", "url": "https://…", "headers": { … } } } }
 * ```
 *
 * Один файл на два клиента — намеренно: проект, который уже описал свои серверы для Claude Code,
 * описал их и для ассистента билдера. Отсюда и правило для stdio-записей: они законны (Claude
 * Code их запускает), но браузеру недоступны — сервер виден в панели со статусом «недоступен из
 * браузера», а не отказом разбора.
 *
 * Вид записи: `type` (`http`, `sse`, `stdio`); без него — по полям, как у Claude Code: есть
 * `command` — stdio, есть `url` — http. Неизвестные поля пропускаются.
 *
 * Разбор отвечает значением: битая запись становится сервером вида `invalid` с причиной, битый
 * файл — замечанием. Ни то ни другое не мешает остальным серверам.
 *
 * @module plugins/forms/mcp/config/mcp-json
 */

import { isServerName, type ServerSpec } from './types';

export interface McpJson {
  readonly servers: readonly ServerSpec[];
  /** Замечания к файлу целиком: не JSON, нет `mcpServers`. */
  readonly problems: readonly string[];
}

const EMPTY: McpJson = { servers: [], problems: [] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Разобрать текст `.mcp.json`; `null` — файла нет. */
export function parseMcpJson(text: string | null): McpJson {
  if (text === null) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { servers: [], problems: ['.mcp.json не разбирается как JSON'] };
  }
  if (!isRecord(value) || !isRecord(value.mcpServers)) {
    return { servers: [], problems: ['.mcp.json: нет объекта mcpServers'] };
  }
  return {
    servers: Object.entries(value.mcpServers).map(([name, entry]) => serverOf(name, entry)),
    problems: [],
  };
}

function invalid(name: string, problem: string): ServerSpec {
  return { kind: 'invalid', name, problem };
}

function serverOf(name: string, entry: unknown): ServerSpec {
  if (!isServerName(name)) {
    return invalid(
      name,
      'имя сервера — строчные латинские буквы, цифры, «-» и «_», до 32 символов'
    );
  }
  if (!isRecord(entry)) return invalid(name, 'запись сервера — не объект');

  const type =
    entry.type ??
    (entry.command !== undefined ? 'stdio' : entry.url !== undefined ? 'http' : undefined);
  if (type === 'stdio') {
    return { kind: 'stdio', name, command: typeof entry.command === 'string' ? entry.command : '' };
  }
  if (type !== 'http' && type !== 'sse') {
    return invalid(name, `неизвестный type «${String(type)}»: ожидается http, sse или stdio`);
  }

  if (typeof entry.url !== 'string' || !isHttpUrl(entry.url)) {
    return invalid(name, 'url — абсолютный адрес http(s)');
  }
  const headers = headersOf(entry.headers);
  if (headers === null) return invalid(name, 'headers — объект строк');

  return {
    kind: type,
    name,
    url: entry.url,
    headers,
    notes: entry.type === undefined ? ['type не указан — подключение по http'] : [],
  };
}

/**
 * Абсолютный ли это адрес http(s). Подстановки `${VAR}` проверяются после подстановки, поэтому
 * здесь достаточно схемы в начале строки.
 */
function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^\$\{[A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?\}/.test(url);
}

function headersOf(value: unknown): Record<string, string> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const headers: Record<string, string> = {};
  for (const [key, header] of Object.entries(value)) {
    if (typeof header !== 'string') return null;
    headers[key] = header;
  }
  return headers;
}
