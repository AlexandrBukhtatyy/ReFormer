/**
 * Открывающие сессии — по требованию: модуль клиента (`./mcp-client`) грузится на первое
 * подключение, а не на активацию плагина.
 *
 * Промис загрузки запоминается целиком: параллельные подключения (два сервера в одном ходе)
 * ждут одной загрузки. Неудача не запоминается — следующий вызов пробует снова: одна сорвавшаяся
 * загрузка чанка не должна выключать MCP до перезагрузки страницы.
 *
 * @module plugins/forms/mcp/connection/openers
 */

import type { SessionOpeners } from './session';

type ClientModule = typeof import('./mcp-client');

/** Открывающие над отложенным модулем клиента. */
export function lazyOpeners(
  load: () => Promise<ClientModule> = () => import('./mcp-client')
): SessionOpeners {
  let loading: Promise<ClientModule> | undefined;
  const module = (): Promise<ClientModule> =>
    (loading ??= load().catch((error: unknown) => {
      loading = undefined;
      throw error;
    }));
  return {
    worker: async (input) => (await module()).createWorkerOpener()(input),
    remote: async (input) => (await module()).createRemoteOpener()(input),
  };
}
