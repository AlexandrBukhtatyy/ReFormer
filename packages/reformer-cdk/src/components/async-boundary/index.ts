// Main compound component
export { AsyncBoundary } from './AsyncBoundary';

// Sub-components (also available as AsyncBoundary.Loading, etc.)
export { AsyncBoundaryRoot } from './AsyncBoundaryRoot';
export { AsyncBoundaryIdle } from './AsyncBoundaryIdle';
export { AsyncBoundaryLoading } from './AsyncBoundaryLoading';
export { AsyncBoundaryContent } from './AsyncBoundaryContent';
export { AsyncBoundaryEmpty } from './AsyncBoundaryEmpty';
export { AsyncBoundaryError } from './AsyncBoundaryError';
export { AsyncBoundaryRetry } from './AsyncBoundaryRetry';

// Hooks
export { useAsyncBoundary } from './useAsyncBoundary';
export { useAsyncResource } from './useAsyncResource';

// Pure state machine (React-free) — переиспользуется в тестах и своих обёртках
export { asyncResourceReducer, initialAsyncResourceState, defaultToError } from './async-resource';

// Context and hooks
export { AsyncBoundaryContext, useAsyncBoundaryContext } from './AsyncBoundaryContext';

// Types
export type {
  AsyncStatus,
  AsyncBoundaryHandle,
  AsyncBoundaryRootProps,
  AsyncBoundarySlotProps,
  AsyncBoundaryContentProps,
  AsyncBoundaryEmptyProps,
  AsyncBoundaryErrorProps,
  AsyncBoundaryErrorRenderProps,
  AsyncBoundaryRetryProps,
} from './types';

export type { AsyncBoundaryContextValue, AsyncBoundaryIds } from './AsyncBoundaryContext';

export type {
  UseAsyncBoundaryOptions,
  UseAsyncBoundaryReturn,
  AsyncBoundaryRootPropGetters,
  AsyncBoundaryLoadingPropGetters,
  AsyncBoundaryErrorPropGetters,
} from './useAsyncBoundary';

export type { UseAsyncResourceOptions, UseAsyncResourceReturn } from './useAsyncResource';

export type { AsyncResourceState, AsyncResourceAction } from './async-resource';
