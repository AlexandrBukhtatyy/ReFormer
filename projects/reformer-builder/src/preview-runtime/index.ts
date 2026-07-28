/**
 * Слой `preview-runtime/` — движок Runtime-preview (спека §9): дефолтный ui-kit-реестр, синтез
 * модели из `$model`-путей, мок-источники, плейсхолдер неизвестного компонента. Монтирование
 * (`convertJsonToM1Tree` + `<JsonFormRenderer>`) — в React-компоненте canvas.
 *
 * @module reformer-builder/preview-runtime
 */

export { buildPreview, buildRegistry, type PreviewBundle } from './build-preview';
export { KNOWN_COMPONENT_NAMES, KNOWN_COMPONENT_NAME_SET, INFRA_NAMES } from './known-names';
export { KNOWN_COMPONENTS, classifyCatalog } from './known-components';
export { collectUnknownComponentNames } from './unknown';
export { makeUnknownComponent, makePreviewLimitedComponent } from './unknown-component';
export {
  OVERLAY_LIMITED,
  SUBPATH_LIMITED,
  isRegistrable,
  resolveUiKitComponent,
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
