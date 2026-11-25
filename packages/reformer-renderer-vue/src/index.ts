/**
 * `@reformer/renderer-vue` — рендерер форм ReFormer для Vue 3.
 *
 * Рисует сборку `createForm` из `@reformer/core`: то же дерево узлов, что рисует рендерер React.
 * Компоненты — из реестра приложения; форма из JSON-документа собирается через вход
 * `@reformer/renderer-json/neutral`.
 *
 * @module renderer-vue
 */

export { FormRenderer } from './form-renderer';
export { RenderNode } from './render-node';
export { MODEL_VALUE_ADAPTER } from './render-field';

// Платформенный слой: сборка формы, состояние поля и поток шагов в компонентах Vue.
export { useFormBundle, useFormBundleContext } from './platform/form-bundle';
export type { FormBundleLike } from './platform/form-bundle';
export {
  provideI18n,
  provideIssueMessages,
  useFieldError,
  useFormControl,
  useIssueMessage,
} from './platform/form-control';
export type { FormControlRefs } from './platform/form-control';
export { useFormFlow } from './platform/form-flow';
export type { FormFlowRefs } from './platform/form-flow';

// Мост сигналов ядра в реактивность Vue.
export { useSignalValue } from './bridge/signals';

export type {
  ArrayComponentProps,
  ArrayItemSlot,
  FieldWrapperProps,
  RenderNodeFn,
  RendererSettings,
  SelfManagedProps,
} from './types';
