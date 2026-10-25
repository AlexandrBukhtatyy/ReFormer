/**
 * Имя плагина и раскладка его файлов в проекте.
 *
 * @module plugins/forms/mcp/contract
 */

import manifest from './manifest.json';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const MCP_PLUGIN_ID = manifest.id;

/** Каталог серверов-бандлов проекта: `.ui_builder/mcp/<имя>/server.js`. */
export const BUNDLED_SERVERS_DIR = ['.ui_builder', 'mcp'] as const;

/** Скрипт сервера-бандла — воркер, который хост запускает из Blob. */
export const SERVER_SCRIPT = 'server.js';

/** Необязательные настройки запуска сервера-бандла. */
export const SERVER_SETTINGS = 'server.json';

/** Удалённые серверы проекта — тот же файл и формат, что у Claude Code. */
export const MCP_JSON = '.mcp.json';
