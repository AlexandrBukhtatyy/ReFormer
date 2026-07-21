// ReFormer-специфичный (не shadcn) контейнер состояний загрузки данных поверх
// headless AsyncBoundary из @reformer/cdk. Не form-control.
export {
  AsyncBoundary,
  AsyncBoundaryLoading,
  AsyncBoundaryError,
  AsyncBoundaryEmpty,
} from './variants/base/async-boundary-base';

export type {
  AsyncStatus,
  AsyncBoundaryProps,
  AsyncBoundaryLoadingProps,
  AsyncBoundaryErrorProps,
  AsyncBoundaryEmptyProps,
} from './variants/base/async-boundary-base';
