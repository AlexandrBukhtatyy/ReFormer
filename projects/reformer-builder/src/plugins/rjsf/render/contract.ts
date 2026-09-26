/**
 * Идентификаторы рендера RJSF — листом без импортов значений: композиция берёт их, не втягивая
 * плагин в стартовый граф.
 *
 * @module plugins/rjsf/render/contract
 */

import manifest from './manifest.json';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const RJSF_RENDER_PLUGIN_ID = manifest.id;

/** Поверхность превью: она же имя источника находок сборки. */
export const RJSF_SURFACE_ID = 'rjsf.preview';
