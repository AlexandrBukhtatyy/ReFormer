/**
 * Сервис ReFormer для стека форм — сервер `reformer-builder` в подключениях MCP ассистента.
 *
 * Компилятор intent (грамматика, судья, документ раскладки), справка по библиотеке и проверка кода
 * живут в сервисе ReFormer, а не в плагине. Своего соединения и своего поля ключа у стека нет: он
 * объявляет сервер в подключениях MCP (`McpConnectionsCapability`, плагин «MCP-серверы»), и
 * человек вводит ключ там же, где настраивает остальные серверы, — на экране настроек ассистента.
 *
 * Сервер объявлен внутренним: модель его инструментов не видит, их зовёт стек. Запись `.mcp.json`
 * с тем же именем главнее объявления — так сервис направляют на свой адрес (on-premise, локальный
 * для разработки).
 *
 * Без подключений (плагин MCP выключен), без ключа или без сервера стек работает без `build_form`,
 * а справка говорит, что её нет: ручная правка формы от сервиса не зависит.
 *
 * @module plugins/reformer/ai/service/link
 */

import {
  McpConnectionsCapability,
  type Disposable,
  type McpConnections,
  type McpServerDeclaration,
  type McpServerSummary,
  type PluginContext,
} from '@reformer/builder-plugin-api';

/** Имя сервера в подключениях — и в `.mcp.json`, если его направляют на свой адрес. */
export const SERVICE_SERVER = 'reformer-builder';

/** Переменная ключа: её значение спросит секция MCP-серверов в настройках ассистента. */
export const SERVICE_KEY_VARIABLE = 'REFORMER_API_KEY';

/** Адрес облачного сервиса, поверхность билдера. */
export const DEFAULT_SERVICE_URL = 'https://mcp.reformer.dev/mcp/builder';

/** Объявление сервера сервиса. */
export function serviceDeclaration(url: string = DEFAULT_SERVICE_URL): McpServerDeclaration {
  return {
    name: SERVICE_SERVER,
    kind: 'http',
    url,
    headers: { Authorization: `Bearer \${${SERVICE_KEY_VARIABLE}}` },
    internal: true,
  };
}

/**
 * Можно ли рассчитывать на сервис: сервер есть, ключ задан, браузер его не запрещает. Ошибка
 * соединения сюда не входит: она преходяща, и снимать из-за неё `build_form` значило бы
 * пересобирать набор инструментов на каждый сетевой сбой, — вызов скажет о ней сам.
 */
export function isServiceReady(server: McpServerSummary | undefined): boolean {
  return (
    server !== undefined && server.status !== 'needs-values' && server.status !== 'unavailable'
  );
}

/** Ответ инструмента сервиса либо почему его нет — словами для модели. */
export type ServiceOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/** Вызов инструмента сервиса; ответ — JSON в тексте. */
export type ServiceCall = <T>(
  tool: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
) => Promise<ServiceOutcome<T>>;

/** Почему сервис недоступен — фразой для модели и человека. */
function unavailableMessage(server: McpServerSummary | undefined): string {
  if (server === undefined) {
    return 'The ReFormer service is not connected: the MCP servers plugin is off.';
  }
  if (server.status === 'needs-values') {
    return (
      `The ReFormer service needs ${server.missing.join(', ')}: ask the user to set it in the ` +
      'assistant settings (MCP servers).'
    );
  }
  return 'The ReFormer service is unavailable from this page.';
}

/**
 * Вызов сервиса через подключения.
 *
 * @param connections - Подключения MCP; функция — плагин MCP вправе подняться позже стека.
 */
export function createServiceCall(connections: () => McpConnections | undefined): ServiceCall {
  return async <T>(tool: string, args: Record<string, unknown>, signal?: AbortSignal) => {
    const current = connections();
    const server = current?.servers().find((item) => item.name === SERVICE_SERVER);
    if (current === undefined || !isServiceReady(server)) {
      return { ok: false, message: unavailableMessage(server) };
    }
    const outcome = await current.callTool(SERVICE_SERVER, tool, args, signal);
    if (!outcome.ok)
      return { ok: false, message: `The ReFormer service failed: ${outcome.message}` };
    const text = outcome.content.find((block) => block.type === 'text')?.text ?? '';
    if (outcome.isError) {
      return { ok: false, message: `The ReFormer service refused ${tool}: ${text}` };
    }
    try {
      return { ok: true, value: JSON.parse(text) as T };
    } catch {
      return { ok: false, message: `The ReFormer service answered ${tool} not in JSON.` };
    }
  };
}

/** Связь стека с сервисом на время активации плагина. */
export interface ServiceLink extends Disposable {
  /** Подключения сейчас; `undefined` — плагина MCP нет. */
  connections(): McpConnections | undefined;
  /** Готов ли сервис сейчас ({@link isServiceReady}). */
  ready(): boolean;
}

/**
 * Объявить сервер сервиса в подключениях и следить за его готовностью.
 *
 * Подключения появляются и исчезают вместе с плагином MCP: объявление ставится заново при каждом
 * появлении слота. `onReadyChange` зовётся, когда готовность сменилась, — стек по нему вносится
 * заново с `build_form` или без. Готовность на момент вызова — `ready()`: о ней `onReadyChange`
 * не сообщает, вызывающий ещё собирает то, что этот слушатель тронет.
 */
export function linkService(
  services: PluginContext['services'],
  onReadyChange: (ready: boolean) => void,
  declaration: McpServerDeclaration = serviceDeclaration()
): ServiceLink {
  let attached: { connections: McpConnections; dispose: () => void } | undefined;
  let ready = false;
  let linking = true;

  const recompute = () => {
    const server = attached?.connections.servers().find((item) => item.name === SERVICE_SERVER);
    const next = isServiceReady(server);
    if (next === ready) return;
    ready = next;
    if (!linking) onReadyChange(next);
  };

  const attach = () => {
    const connections = services.get(McpConnectionsCapability);
    if (connections === attached?.connections) return;
    attached?.dispose();
    attached = undefined;
    if (connections !== undefined) {
      const declared = connections.declare(declaration);
      const watched = connections.subscribe(recompute);
      attached = {
        connections,
        dispose: () => {
          watched.dispose();
          declared.dispose();
        },
      };
    }
    recompute();
  };

  attach();
  linking = false;
  const changes = services.onDidChange?.((change) => {
    if (change.id === McpConnectionsCapability.id) attach();
  });

  return {
    connections: () => attached?.connections,
    ready: () => ready,
    dispose() {
      changes?.dispose();
      attached?.dispose();
      attached = undefined;
    },
  };
}
