/**
 * Логика асинхронного источника опций живёт в `@reformer/cdk/option-source` — её делят Select,
 * SelectMulti и `Input` с подсказками. Модуль сохранён как точка импорта для вариантов Select.
 *
 * @module ui/select-resource
 */
export {
  resolveStrategyFlags,
  normalizeItems,
  mergeOptions,
  filterClient,
  resourceReducer,
  initialResourceState,
  hasMore,
  isNearBottom,
  type ResourceLoadParams,
  type ResourceItem,
  type ResourceResult,
  type ResourceStrategy,
  type ResourceConfig,
  type NormalizedOption,
  type StrategyFlags,
  type ResourceState,
  type ResourceAction,
} from '@reformer/cdk/option-source';
