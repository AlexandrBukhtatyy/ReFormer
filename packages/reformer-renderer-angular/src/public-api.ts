/**
 * @reformer/renderer-angular — рендерер форм `@reformer/core` на Angular.
 *
 * Рисует сборку `createForm`: дерево узлов схемы компонентами реестра. Компоненты — обычные
 * standalone-компоненты Angular: пропсы узла приходят им входами и выходами, дети — содержимым
 * (`<ng-content />`).
 */

export { FormRenderer } from './lib/form-renderer.component';
export { ReformerArrayItem, ReformerNode, VALUE_CHANGE_ADAPTER } from './lib/node.directive';
export {
  FORM_BUNDLE,
  ISSUE_MESSAGES,
  REFORMER_I18N,
  provideIssueMessages,
  provideReformerI18n,
} from './lib/context';
export { fromCoreSignal } from './lib/bridge/signals';
export { injectFormBundle, ownFormBundle, type FormBundleLike } from './lib/platform/form-bundle';
export {
  fieldError,
  formControlSignals,
  injectIssueMessage,
  type FormControlSignals,
} from './lib/platform/form-control';
export { formFlowSignals, type FormFlowSignals } from './lib/platform/form-flow';
export type {
  ArrayComponentInputs,
  ArrayItemContent,
  ArrayItemSlot,
  FieldWrapperInputs,
  RendererSettings,
  SelfManagedInputs,
} from './lib/types';
