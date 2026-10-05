/**
 * Рендер домена RJSF: поверхность превью с темой из активного кита.
 *
 * Бочка — для тестов и соседей по монорепозиторию. Оболочка грузит плагин из `./main`.
 *
 * @module plugins/rjsf/render
 */

export { createRjsfRenderPlugin, RJSF_RENDER_PLUGIN_ID } from './plugin';
export { RJSF_SURFACE_ID } from './contract';
export { RJSF_RENDER_MESSAGES } from './messages';
