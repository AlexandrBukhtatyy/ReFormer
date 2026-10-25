/**
 * Ресурсы `mcp:` — продолжение того, что не влезло в ответ инструмента.
 *
 * Ответ вклада ассистент режет до 1500 символов; ответ `generate_form` сервера ReFormer длиннее
 * в разы. Полный текст длинного ответа кладётся сюда (`mcp:result/<n>`), полная схема инструмента
 * читается отсюда же (`mcp:<server>/<tool>`), а модель читает их встроенным `read_resource`
 * страницами — новой поверхности инструментов это не стоит.
 *
 * Хранится кольцо последних {@link KEPT_RESULTS} длинных ответов: старше ход их уже не читает, а
 * копить мегабайты чужих ответов за сессию незачем.
 *
 * @module plugins/forms/mcp/assistant/results
 */

import type { AssistantResourceProvider } from '@reformer/builder-plugin-api';
import type { McpManager } from '../connection/manager';
import { fullToolText, untrusted } from './format';

/** Сколько длинных ответов помнится. */
export const KEPT_RESULTS = 8;

/** Схема адресов провайдера. */
export const MCP_SCHEME = 'mcp';

export interface ResultStore {
  /** Сохранить полный текст; ответ — адрес ресурса. */
  keep(server: string, tool: string, text: string): string;
  read(
    id: number
  ): { readonly server: string; readonly tool: string; readonly text: string } | undefined;
}

export function createResultStore(): ResultStore {
  const kept: { id: number; server: string; tool: string; text: string }[] = [];
  let next = 1;
  return {
    keep(server, tool, text) {
      const id = next++;
      kept.push({ id, server, tool, text });
      if (kept.length > KEPT_RESULTS) kept.shift();
      return `${MCP_SCHEME}:result/${id}`;
    },
    read: (id) => kept.find((entry) => entry.id === id),
  };
}

/** Провайдер ресурсов `mcp:` для ассистента. */
export function createResultsProvider(
  manager: McpManager,
  store: ResultStore
): AssistantResourceProvider {
  return {
    scheme: MCP_SCHEME,
    describe:
      'mcp:result/<n> — full text of a long mcp_call result; mcp:<server>/<tool> — full description and input schema of an MCP tool.',
    async read(uri, signal) {
      const rest = uri.slice(MCP_SCHEME.length + 1);
      const result = /^result\/(\d+)$/.exec(rest);
      if (result !== null) {
        const entry = store.read(Number(result[1]));
        if (entry === undefined) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: `${uri} is no longer kept: call the tool again.` },
          };
        }
        return {
          ok: true,
          text: `${untrusted(entry.server, entry.tool)}\n${entry.text}`,
          mediaType: 'text/plain',
        };
      }

      const tool = /^([^/]+)\/(.+)$/.exec(rest);
      if (tool === null) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Unknown MCP resource ${uri}: expected mcp:result/<n> or mcp:<server>/<tool>.`,
          },
        };
      }
      const [, server, name] = tool as unknown as [string, string, string];
      const tools = await manager.tools(server, signal);
      if (!tools.ok) return { ok: false, error: tools.error };
      const found = tools.value.find((candidate) => candidate.name === name);
      if (found === undefined) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `MCP server ${server} has no tool "${name}".`,
            suggestions: tools.value.map((candidate) => candidate.name),
          },
        };
      }
      return { ok: true, text: fullToolText(server, found), mediaType: 'text/plain' };
    },
  };
}
