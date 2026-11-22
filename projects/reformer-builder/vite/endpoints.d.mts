/**
 * Объявления для `endpoints.mjs` — их импортируют тесты.
 *
 * @module vite/endpoints
 */

import type { RevisionMemo } from '../bin/plugins-index.mjs';

/** Запрос и ответ в объёме, который нужен обработчику. */
export interface EndpointRequest {
  readonly url?: string;
  readonly method?: string;
  readonly headers?: Record<string, unknown>;
}

export type EndpointNext = (error?: unknown) => void;

export interface BuilderEndpointsOptions {
  /** Конфиг уровня запуска либо `null`. Читается на каждый запрос. */
  readonly readConfig: () => Promise<unknown>;
  /**
   * Каталог плагинов приложения на диске; `null` — плагины лежат внутри того, что отдаёт `ui`.
   * С `revisions` каталог живой: индекс несёт ревизии плагинов.
   */
  readonly plugins: {
    readonly dir: string;
    readonly include?: readonly string[];
    readonly revisions?: RevisionMemo;
  } | null;
  /** Названные, но не собранные плагины. */
  readonly onMissingPlugins?: (plugins: readonly string[]) => void;
  /** Интерфейс билдера: всё под префиксом, на что не ответили конфиг и плагины. */
  readonly ui: (req: EndpointRequest, res: unknown, next: EndpointNext) => void;
}

/** Префикс билдера на dev-сервере приложения. */
export const BUILDER_URL_PREFIX: string;

/** Прослойка dev-сервера: отвечает на адреса с префиксом, остальное отдаёт дальше. */
export function createBuilderEndpoints(
  options: BuilderEndpointsOptions
): (req: EndpointRequest, res: unknown, next: EndpointNext) => void;
