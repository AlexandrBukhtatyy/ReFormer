/**
 * Слой `preview-runtime/` — движок Runtime-preview (спека §9): дефолтный ui-kit-реестр, синтез
 * модели из `$model`-путей, мок-источники, плейсхолдер неизвестного компонента. Монтирование
 * (`convertJsonToM1Tree` + `<JsonFormRenderer>`) — в React-компоненте canvas.
 *
 * @module reformer-builder/preview-runtime
 */

export { buildPreview, buildRegistry, type PreviewBundle } from './build-preview';
export {
  getActivePreviewModel,
  setActivePreviewModel,
  subscribeActivePreviewModel,
} from './active-preview';
export { annotateSchema } from './annotate-schema';
export {
  encodeNodeToken,
  decodeNodeToken,
  tokenFromClassName,
  NODE_CLASS_PREFIX,
  EMPTY_CLASS,
} from './node-token';
export { PreviewStep } from './preview-step';
export {
  knownComponentNames,
  knownComponentNameSet,
  resetKnownNames,
  INFRA_NAMES,
} from './known-names';
export {
  knownComponents,
  buildKnownComponents,
  resetKnownComponents,
  kitProviderComponent,
  classifyCatalog,
} from './known-components';
export { createWizardPreview, type KitFormWizard } from './wizard-preview';
export { collectUnknownComponentNames } from './unknown';
export { makeUnknownComponent, makePreviewLimitedComponent } from './unknown-component';
export { WizardFormProvider, useWizardForm, type PreviewFormProxy } from './wizard-form-context';
export {
  OVERLAY_LIMITED,
  SUBPATH_LIMITED,
  isRegistrable,
  resolveUiKitComponent,
  resolveKitComponent,
  classify,
  type RenderPolicy,
  type UiKitNamespace,
} from './render-policy';
export { registerMockSources } from './mock-sources';
export {
  synthMock,
  classifyDataSources,
  inferFieldKind,
  mockOptions,
  type MockData,
  type MockOption,
  type SynthMockOptions,
  type FieldKind,
  type DataSourceClasses,
} from './mock-synth';
export {
  synthModel,
  buildInitialValues,
  collectFieldDefaults,
  type FieldDefault,
} from './synth-model';
