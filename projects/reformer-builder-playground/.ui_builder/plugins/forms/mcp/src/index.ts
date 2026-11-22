/**
 * Плагин «MCP-серверы» — точка входа для тестов и соседей по домену. Оболочка грузит плагин из
 * `./main`.
 *
 * @module plugins/forms/mcp/index
 */

export {
  createMcpPlugin,
  mcpConnections,
  mcpSettingsSection,
  MCP_PLUGIN_ID,
  MCP_SETTINGS_SECTION_ID,
  MCP_RELOAD_COMMAND_ID,
  type McpPluginOptions,
} from './plugin';
export {
  createMcpManager,
  isInternal,
  modelView,
  type McpManager,
  type McpSnapshot,
  type ServerView,
} from './connection/manager';
export { createSupervisor, DEFAULT_POLICY, type SupervisorPolicy } from './connection/supervisor';
export type { McpSession, McpTool, SessionOpeners } from './connection/session';
export { MCP_CALL_NAME, MCP_TOOLS_NAME } from './assistant/facade';
export type { McpHost } from './host';
