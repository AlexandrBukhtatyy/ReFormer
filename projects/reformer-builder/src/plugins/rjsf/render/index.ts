/**
 * Рендер домена RJSF: поверхность превью с темой из активного кита.
 *
 * @module plugins/rjsf/render
 */

import { createRjsfRenderPlugin } from './plugin';

export { createRjsfRenderPlugin, RJSF_RENDER_PLUGIN_ID } from './plugin';
export { RJSF_SURFACE_ID } from './contract';
export { RJSF_RENDER_MESSAGES } from './messages';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Портов оболочки плагину не нужно: всё он берёт возможностями в `activate`.
 */
export default function builtin() {
  return createRjsfRenderPlugin();
}
