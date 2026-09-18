/**
 * Публичная поверхность превью-хоста: то, что берёт композиция, и ничего больше.
 *
 * Контракт превью — точка поверхностей и возможность живого вида — объявлен в
 * `@reformer/builder-plugin-api`; поверхности вносят плагины стеков (у стека ReFormer это
 * `plugins/preview-runtime`). Композиции отсюда нужны фабрика плагина и тип его порта: адрес
 * документа и права источника, чтобы выбрать поверхность, и смена файлов, чтобы снять
 * устаревшие находки сборки.
 *
 * @module plugins/preview
 */

export { createPreviewPlugin, PREVIEW_PLUGIN_ID, type PreviewPluginOptions } from './plugin';
export type { LiveDocument, PreviewHostPort, PreviewSourceCapabilities } from './host';
export { PREVIEW_MESSAGES } from './messages';

/**
 * Правило выбора поверхности — наружу ради проверок сборки: какую поверхность получит документ
 * при таких-то правах источника, решает оно одно.
 */
export { chooseSurface, surfaceRank } from './surface/selection';
export type { SurfaceChoice, SurfaceFallback, SurfaceOption } from './surface/selection';
