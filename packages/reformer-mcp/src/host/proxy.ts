/**
 * Тонкий клиент: сервер MCP для агента, который переправляет вызовы в сервис ReFormer.
 *
 * Агент видит те же инструменты, инструкции, ресурсы и промпты, что у сервиса. Вызов инструмента
 * и чтение ресурса идут циклом: клиент кладёт в запрос снимок того, что сервису понадобится
 * (каталоги формы, спеки, каталог кита, состояние сеанса), сервис отвечает либо просьбой добрать
 * недостающее, либо результатом с операциями над диском. Операции клиент применяет сам — у
 * сервиса диска пользователя нет.
 *
 * @module @reformer/mcp/host/proxy
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
  type ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import { observeCall, type ReformerServerCall } from '../contract/call.js';
import { createLocalHost, type LocalHost } from './local.js';
import {
  HOST_META_KEY,
  HOST_PROTOCOL_VERSION,
  MAX_HOST_ROUNDS,
  dirKeyOf,
  hostMetaOf,
  type HostDirectory,
  type HostNeed,
  type HostOp,
  type HostTypecheckResult,
} from '../contract/protocol.js';

export interface ServiceProxyOptions {
  /** Адрес сервиса без пути: `https://mcp.reformer.dev`. */
  readonly url: string;
  /** Поверхность (`REFORMER_SURFACE`); без неё — умолчание сервиса. */
  readonly surface?: string;
  /** Ключ облака; без него запрос уходит без `Authorization`. */
  readonly apiKey?: string;
  readonly version: string;
  /** Диск пользователя; без него — рабочий каталог процесса. */
  readonly host?: LocalHost;
  /** Предел одного запроса к сервису, мс: сборка формы с проверкой типов бывает долгой. */
  readonly timeoutMs?: number;
  /**
   * Наблюдатель вызовов — тот же журнал, что у локального сервера (`REFORMER_TRACE_FILE`): для
   * агента клиент и есть сервер, и замеры стенда читают ответы отсюда.
   */
  readonly onCall?: (call: ReformerServerCall) => void;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

/** Строковые значения `dir:` и `specPath:` в коде скрипта — что открыть заранее. */
function literalsOf(code: string, key: 'dir' | 'specPath'): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`\\b${key}\\s*:\\s*(["'\`])([^"'\`\\n]+)\\1`, 'g');
  for (const match of code.matchAll(pattern)) found.push(match[2]!);
  return found;
}

/** Черновик блока протокола одного вызова: копится по раундам. */
interface Draft {
  v: number;
  state?: unknown;
  dirs: Record<string, HostDirectory>;
  specs: Record<string, string | null>;
  specBase: string;
  issuesLocation: string;
  uiKitCatalog: { hash: string; json?: unknown } | null;
  typechecks: Record<string, HostTypecheckResult>;
  platform?: unknown;
}

function withoutHostMeta<T extends { _meta?: Record<string, unknown> }>(result: T): T {
  if (!result._meta || !(HOST_META_KEY in result._meta)) return result;
  const meta = Object.fromEntries(
    Object.entries(result._meta).filter(([key]) => key !== HOST_META_KEY)
  );
  const { _meta: _dropped, ...rest } = result;
  return (Object.keys(meta).length ? { ...rest, _meta: meta } : rest) as T;
}

/** Ошибка сети, а не ответ сервиса: соединение закрылось, не открылось, оборвалось. */
function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : '';
  return /fetch failed|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up|other side closed|UND_ERR/i.test(
    message
  );
}

/**
 * Повторить запрос один раз после ошибки сети. Безопасно: сервис ничего не пишет и состояния не
 * держит, а операции над диском клиент применяет только из полученного ответа — потерянный ответ
 * ничего не изменил.
 */
async function sendWithRetry<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await send();
  }
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Подключиться к сервису и собрать сервер для агента. Транспорт к агенту подключает вызывающий:
 * stdio в `src/index.ts`, транспорт в памяти в тестах.
 */
export async function connectServiceProxy(options: ServiceProxyOptions): Promise<Server> {
  const local = options.host ?? createLocalHost();
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = options.url.replace(/\/+$/, '');
  const endpoint = new URL(`${base}/mcp${options.surface ? `/${options.surface}` : ''}`);
  const client = new Client({ name: 'reformer-mcp-client', version: options.version });
  await client.connect(
    new StreamableHTTPClientTransport(endpoint, {
      requestInit: options.apiKey
        ? { headers: { Authorization: `Bearer ${options.apiKey}` } }
        : undefined,
    })
  );

  const capabilities = client.getServerCapabilities() ?? {};
  const instructions = client.getInstructions();
  const server = new Server(
    { name: 'reformer-mcp', version: options.version },
    {
      capabilities: {
        ...(capabilities.tools ? { tools: {} } : {}),
        ...(capabilities.resources ? { resources: {} } : {}),
        ...(capabilities.prompts ? { prompts: {} } : {}),
      },
      ...(instructions ? { instructions } : {}),
    }
  );

  // Сеанс живёт у клиента: состояние каталога инструментов, открытые каталоги форм, отпечатки
  // каталога кита, которые сервис уже видел.
  let state: unknown;
  const activeDirs = new Set<string>();
  const knownCatalogs = new Set<string>();

  const draftFor = (args: Record<string, unknown> | undefined): Draft => {
    const catalog = local.uiKitCatalog();
    const draft: Draft = {
      v: HOST_PROTOCOL_VERSION,
      ...(state !== undefined ? { state } : {}),
      dirs: {},
      specs: {},
      specBase: local.specBase(),
      issuesLocation: local.issuesLocation(),
      uiKitCatalog: catalog
        ? knownCatalogs.has(catalog.hash)
          ? { hash: catalog.hash }
          : { hash: catalog.hash, json: catalog.json }
        : null,
      typechecks: {},
    };
    // Ключи от сервиса уже нормализованы (пустой — каталог по умолчанию); из аргументов — нет.
    const dirs = new Set(activeDirs);
    const specs = new Set<string>();
    if (typeof args?.dir === 'string') dirs.add(dirKeyOf(args.dir));
    if (typeof args?.specPath === 'string') specs.add(args.specPath);
    if (typeof args?.code === 'string') {
      for (const dir of literalsOf(args.code, 'dir')) dirs.add(dirKeyOf(dir));
      for (const spec of literalsOf(args.code, 'specPath')) specs.add(spec);
    }
    for (const dir of dirs) draft.dirs[dir] = local.directory(dir);
    for (const spec of specs) draft.specs[spec] = local.spec(spec);
    return draft;
  };

  const fulfil = async (draft: Draft, need: HostNeed): Promise<void> => {
    for (const dir of need.dirs ?? []) draft.dirs[dir] = local.directory(dir);
    for (const { dir, name } of need.above ?? []) {
      const entry = draft.dirs[dir] ?? local.directory(dir);
      draft.dirs[dir] = entry.ok
        ? { ...entry, above: { ...entry.above, [name]: local.above(dir, name) } }
        : entry;
    }
    for (const spec of need.specs ?? []) draft.specs[spec] = local.spec(spec);
    if (need.uiKitCatalog) {
      const catalog = local.uiKitCatalog();
      draft.uiKitCatalog = catalog ? { hash: catalog.hash, json: catalog.json } : null;
    }
    for (const check of need.typechecks ?? []) {
      draft.typechecks[check.key] = await local.typecheck(check.dir, check.files);
    }
    if (need.platform) draft.platform = local.platform();
  };

  /** Ответ сервиса применён: операции на диске, новое состояние, открытые каталоги. */
  const settle = (draft: Draft, ops: readonly HostOp[], next: unknown, dirs: unknown): void => {
    local.apply(ops);
    if (next !== undefined) state = next;
    if (Array.isArray(dirs))
      for (const dir of dirs) if (typeof dir === 'string') activeDirs.add(dir);
    if (draft.uiKitCatalog?.hash) knownCatalogs.add(draft.uiKitCatalog.hash);
  };

  /** Вызов с добором данных: до {@link MAX_HOST_ROUNDS} раундов. */
  async function hostRound<T extends { _meta?: Record<string, unknown> }>(
    args: Record<string, unknown> | undefined,
    send: (meta: Draft) => Promise<T>,
    fail: (text: string) => T
  ): Promise<T> {
    const draft = draftFor(args);
    for (let round = 0; round < MAX_HOST_ROUNDS; round++) {
      let result: T;
      try {
        result = await sendWithRetry(() => send(draft));
      } catch (error) {
        return fail(
          `The ReFormer service did not answer: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      const host = hostMetaOf(result._meta);
      if (!host) return result;
      if (host.need && typeof host.need === 'object') {
        await fulfil(draft, host.need as HostNeed);
        continue;
      }
      try {
        settle(draft, Array.isArray(host.ops) ? (host.ops as HostOp[]) : [], host.state, host.dirs);
      } catch (error) {
        return fail(
          `The form files could not be written: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return withoutHostMeta(result);
    }
    return fail(
      `The ReFormer service kept asking for local files after ${MAX_HOST_ROUNDS} rounds; the call was not completed.`
    );
  }

  const observe = <T>(
    call: Pick<ReformerServerCall, 'kind' | 'name' | 'arguments'>,
    run: () => Promise<T>
  ): Promise<T> => (options.onCall ? observeCall(options.onCall, call, run) : run());

  if (capabilities.tools) {
    server.setRequestHandler(ListToolsRequestSchema, (request) =>
      client.listTools(request.params, { timeout })
    );
    server.setRequestHandler(CallToolRequestSchema, (request) =>
      observe(
        { kind: 'tool', name: request.params.name, arguments: request.params.arguments },
        () =>
          hostRound<CallToolResult>(
            request.params.arguments,
            async (draft) =>
              (await client.callTool(
                {
                  ...request.params,
                  _meta: { ...request.params._meta, [HOST_META_KEY]: draft },
                },
                undefined,
                { timeout }
              )) as CallToolResult,
            errorResult
          )
      )
    );
  }
  if (capabilities.resources) {
    server.setRequestHandler(ListResourcesRequestSchema, (request) =>
      client.listResources(request.params, { timeout })
    );
    server.setRequestHandler(ListResourceTemplatesRequestSchema, (request) =>
      client.listResourceTemplates(request.params, { timeout })
    );
    server.setRequestHandler(ReadResourceRequestSchema, (request) =>
      observe({ kind: 'resource', name: request.params.uri, arguments: undefined }, () =>
        hostRound<ReadResourceResult>(
          undefined,
          (draft) =>
            client.readResource(
              { ...request.params, _meta: { ...request.params._meta, [HOST_META_KEY]: draft } },
              { timeout }
            ),
          (text) => {
            throw new Error(text);
          }
        )
      )
    );
  }
  if (capabilities.prompts) {
    server.setRequestHandler(ListPromptsRequestSchema, (request) =>
      client.listPrompts(request.params, { timeout })
    );
    server.setRequestHandler(GetPromptRequestSchema, (request) =>
      observe(
        { kind: 'prompt', name: request.params.name, arguments: request.params.arguments },
        () => client.getPrompt(request.params, { timeout })
      )
    );
  }

  server.onclose = () => {
    void client.close();
  };
  return server;
}
