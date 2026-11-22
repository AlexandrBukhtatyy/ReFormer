// Pure core (React-free): стратегии загрузки, нормализация, слияние страниц, фильтрация.
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
} from './option-source';

// React-обёртка: загрузка по стратегии, серверный поиск с debounce, пагинация.
export { useResourceOptions, type UseResourceOptionsResult } from './useResourceOptions';
