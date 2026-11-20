/**
 * Машина состояний асинхронной загрузки для `AsyncBoundary` и загрузки файлов.
 *
 * Сама машина живёт в ядре (`@reformer/core/resource`) — на ней же стоит `resource()`, основа
 * серверной таблицы. Здесь — ре-экспорт под прежними именами: публичный API cdk не меняется, а
 * переходы «старт / успех / ошибка / отмена / пропуск» у ядра и cdk одни.
 *
 * @module reformer/cdk/async-boundary/async-resource
 */

export {
  asyncResourceReducer,
  initialAsyncResourceState,
  rejectionMessage,
  defaultToError,
} from '@reformer/core/resource';
export type { AsyncResourceState, AsyncResourceAction } from '@reformer/core/resource';
