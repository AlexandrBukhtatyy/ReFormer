/**
 * Слой `preview-runtime/` — движок Runtime-preview (спека §9): дефолтный ui-kit-реестр, синтез
 * модели из `$model`-путей, мок-источники, плейсхолдер неизвестного компонента. Монтирование
 * (`convertJsonToM1Tree` + `<JsonFormRenderer>`) — в React-компоненте canvas.
 *
 * @module reformer-builder/preview-runtime
 */

export { buildPreview, type PreviewBundle } from './build-preview';
export { KNOWN_COMPONENT_NAMES, KNOWN_COMPONENT_NAME_SET } from './known-names';
export { KNOWN_COMPONENTS } from './known-components';
export { collectUnknownComponentNames } from './unknown';
export { makeUnknownComponent } from './unknown-component';
export {
  registerMockSources,
  collectFunctionLikeDataSources,
} from './mock-sources';
export {
  synthModel,
  buildInitialValues,
  collectFieldDefaults,
  type FieldDefault,
} from './synth-model';
