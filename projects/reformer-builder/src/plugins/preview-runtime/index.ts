/**
 * Поверхности превью стека ReFormer: рантайм (`renderer-json` по схеме) и компилирующая
 * (схема плюс исполненные сайдкары формы), а также панель модели.
 *
 * Композиции отсюда нужны фабрика плагина и ТИПЫ порта — порт в этой фазе ещё собирает
 * оболочка (`shell/boot/ports/preview`). Значения, которые нужны ей до загрузки плагина, живут
 * листом в `./contract`: импорт значения из бареля втянул бы весь плагин в стартовый граф.
 *
 * @module plugins/preview-runtime
 */

export {
  builtinSurfaces,
  createPreviewRuntimePlugin,
  PREVIEW_RUNTIME_PLUGIN_ID,
  type PreviewRuntimePluginOptions,
} from './plugin';

export { PREVIEW_RUNTIME_MESSAGES } from './messages';
export { previewHostFromContext, KitCapability, type KitReader } from './host-from-context';

export type {
  MessageSink,
  PreviewDocument,
  PreviewHost,
  PreviewModuleError,
  PreviewModuleGraph,
  PreviewModules,
  PreviewSourceCapabilities,
  Translate,
} from './host';

export { COMPILING_SURFACE_ID } from './compiling/surface';
export { RUNTIME_SURFACE_ID } from './runtime/surface';
export { MODEL_PANEL_ID } from './ui/ModelPanel';
