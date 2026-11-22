/**
 * Объявления для `plugin.mjs` — конфиги сборки пишутся на TypeScript.
 *
 * @module reformer/kit-hexa-ui/vite
 */

import type { Plugin } from 'vite';

export { HEXA_SCOPE, HEXA_SCOPE_ATTRIBUTE, scopeHexaCss, scopeInjectedCss } from './scope-css.mjs';

/**
 * Стили HexaUI — только внутри `KitProvider`: ресет antd и голые селекторы CSS-модулей уходят
 * под контейнер провайдера, классы дизайн-системы остаются глобальными (порталы).
 */
export declare function hexaUiStyles(): Plugin;

export default hexaUiStyles;
