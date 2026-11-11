/**
 * Сверка сборки воркера ReFormer с плагинами конструктора.
 *
 * Воркер MCP (`.ui_builder/mcp/reformer/server.js`) собирает `npm run mcp:build`, а компилятор
 * intent и корпус справки едут в плагинах — их собирает `npm run plugins:build`. Собранные из
 * разных состояний `@reformer/mcp`, они судят одну форму по-разному: `validate_form` воркера
 * пропускает то, на чём `build_form` ассистента падает, и наоборот. Снаружи этого не видно — видно
 * только странные ответы модели.
 *
 * Воркер называет метку своей сборки в `serverInfo.version` (`6.0.0+<метка>`), плагин знает свою
 * (`@reformer/mcp/build-info`). Расхождение — заметка у сервера в панели MCP, для человека
 * (фаза 5 аудита, ReFormer-11oe.6).
 *
 * @module plugins/forms/mcp/connection/build-check
 */

import { BUILD_ID, buildIdOf } from '@reformer/mcp/build-info';
import type { McpServerInfo } from './session';

/** Имя, которым представляется сервер ReFormer (`serverInfo.name`). */
export const REFORMER_SERVER_NAME = 'reformer-mcp';

/**
 * Заметка о расхождении сборок; `null` — сервер не ReFormer, ещё не подключался или сборки совпали.
 *
 * @param own - Метка сборки плагина; `dev` — плагин собран из исходников, сверять не с чем.
 */
export function buildMismatchNote(
  server: McpServerInfo | undefined,
  own: string = BUILD_ID
): string | null {
  if (server?.name !== REFORMER_SERVER_NAME || own === 'dev') return null;
  const theirs = buildIdOf(server.version);
  if (theirs === own) return null;
  const rebuild = 'пересоберите оба: npm run mcp:build && npm run plugins:build';
  return theirs === null
    ? `воркер ReFormer (${server.version}) собран без метки сборки, плагины — со сборкой ${own}: ${rebuild}`
    : `воркер ReFormer собран из другой сборки @reformer/mcp (${theirs}), чем плагины (${own}) — ` +
        `проверка формы и справка могут расходиться с build_form; ${rebuild}`;
}
