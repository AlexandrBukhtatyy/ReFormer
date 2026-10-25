/**
 * MCP-сервер ReFormer в Web Worker — тот же набор инструментов и ресурсов, что под Node, над
 * вшитым корпусом знаний.
 *
 * Бандл воркера (`scripts/build-worker.mjs`) вызывает {@link startWorkerServer} на старте скрипта
 * с `self` в роли порта: хост запускает воркер и сразу говорит с ним по MCP через `postMessage`
 * (`./port-transport`). Ни диска, ни сети: знание собирается из артефакта корпуса, который бандл
 * несёт в себе.
 *
 * Профиль `browser` (`core/server/tool-catalog`): без `report_issue` и `debug`, `plan_form` — от
 * описания. Промптов нет — они рендерятся шаблонами с диска и просят sampling у клиента, а
 * воркер не умеет ни того, ни другого.
 *
 * Корпус разбирается ЛЕНИВО: `initialize` и `tools/list` отвечают сразу, а мегабайты JSON
 * разбираются на первый вызов, которому нужно знание. Хост будит воркер на вызов и усыпляет по
 * простою — заплатить разбор при каждом пробуждении ради списка инструментов было бы зря.
 *
 * @module reformer-mcp/platform/worker/server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Knowledge } from '../../core/knowledge.js';
import { mountReformerServer } from '../../core/server/mount.js';
import { createResourceCatalog } from '../../core/server/resource-catalog.js';
import { createToolCatalog } from '../../core/server/tool-catalog.js';
import { createBrowserKnowledge, type BrowserKnowledgeInput } from '../browser/knowledge.js';
import { createPortTransport, type MessagePortLike } from './port-transport.js';

export interface WorkerServerOptions {
  /** Порт к хосту: `self` воркера (в тестах — конец `MessageChannel`). */
  readonly port: MessagePortLike;
  /** Версия сервера для `initialize` — версия пакета на момент сборки бандла. */
  readonly version: string;
  /** Корпус знаний. Функция: разбор откладывается до первого вызова, которому он нужен. */
  readonly corpus: () => BrowserKnowledgeInput;
}

export interface WorkerServer {
  readonly server: Server;
  readonly transport: Transport;
  /** Разрешается, когда транспорт подключён. */
  readonly connected: Promise<void>;
}

/** Поднять сервер ReFormer на порту. */
export function startWorkerServer(options: WorkerServerOptions): WorkerServer {
  let knowledge: Knowledge | undefined;
  const lazyKnowledge = (): Knowledge =>
    (knowledge ??= createBrowserKnowledge(options.corpus()).knowledge);

  const server = new Server(
    { name: 'reformer-mcp', version: options.version },
    { capabilities: { tools: {}, resources: {} } }
  );
  mountReformerServer(server, {
    tools: createToolCatalog(lazyKnowledge, { profile: 'browser' }),
    resources: createResourceCatalog(lazyKnowledge),
  });

  // Транспорт создаётся и подключается сразу, на старте скрипта: слушатель порта должен стоять
  // раньше, чем до воркера дойдёт `initialize` хоста.
  const transport = createPortTransport(options.port);
  const connected = server.connect(transport);
  return { server, transport, connected };
}
