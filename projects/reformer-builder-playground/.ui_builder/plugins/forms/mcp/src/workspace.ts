/**
 * Порт рабочей области MCP, собранный из служб контекста активации.
 *
 * Ни одна служба здесь не привилегированная: файлы, источник, документы и секреты плагина видны
 * любому плагину. Прав манифест поэтому не просит — запуск кода бандла ограничивает не право
 * плагина, а источник проекта (`executesCode`), как у плагинов проекта.
 *
 * Документы и записи рабочей области даёт сама оболочка — они берутся `require`. Источник
 * (`WorkspaceSourceCapability`) — `get` в момент чтения: без него скрипт читается из рабочей копии,
 * дороже, но так же верно.
 *
 * @module plugins/forms/mcp/workspace
 */

import {
  DocumentsServiceToken,
  useTranslate,
  WorkspaceFilesServiceToken,
  WorkspaceSourceCapability,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import type { McpHost } from './host';

export function mcpWorkspace(ctx: PluginContext): McpHost {
  const documents = ctx.services.require(DocumentsServiceToken);
  const files = ctx.services.require(WorkspaceFilesServiceToken);

  return {
    projectRoot: files.projectRoot,
    resolve: files.resolve,
    list: files.list,
    readText: files.readText,

    async readScript(id, maxBytes) {
      const source = ctx.services.get(WorkspaceSourceCapability);
      if (source !== undefined) return source.readText(id, { maxBytes });
      const text = await files.readText(id);
      return text === null
        ? { ok: false, error: { kind: 'not-found', message: `${id} not found` } }
        : { ok: true, value: { text, mediaType: 'text/javascript' } };
    },

    executesCode: files.executesCode,
    onDidChangeFiles: (cb) => files.onDidChange(cb),
    onDidChangeProject: (cb) => documents.onDidChange(cb),
    secrets: ctx.secrets,

    // Именованная функция: правила хуков опознают хук по имени объявления.
    useTranslate: function useMcpTranslate() {
      return useTranslate(ctx.i18n);
    },
  };
}
