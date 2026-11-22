/**
 * `@reformer/core/resource` — асинхронная загрузка на сигналах.
 *
 * - `resource({ key, load, … })` — реактивный ключ, отмена устаревших запросов через
 *   `AbortSignal`, stale-while-revalidate, время жизни в области (`createStore`).
 * - Машина состояний загрузки — `asyncResourceReducer` и помощники. Её же использует cdk
 *   (`AsyncBoundary`, загрузка файлов): один источник переходов на все пакеты.
 *
 * React не нужен: в компоненте ресурс читают `useSignalSnapshot(res.state)` или создают в
 * `useStore(() => resource(…))` из `@reformer/core/react`.
 *
 * @group Resource
 * @module resource
 */

export { resource } from './resource';
export type { Resource, ResourceOptions } from './resource';
export {
  asyncResourceReducer,
  initialAsyncResourceState,
  rejectionMessage,
  defaultToError,
} from './machine';
export type { AsyncResourceAction, AsyncResourceState, AsyncStatus } from './machine';
