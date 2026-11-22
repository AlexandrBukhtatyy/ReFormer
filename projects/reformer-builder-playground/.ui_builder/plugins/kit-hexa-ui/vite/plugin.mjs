// @ts-check
/**
 * Vite-плагин приложения, которое рисует формы на ките HexaUI: стили дизайн-системы действуют
 * только внутри `KitProvider`, а не на всё приложение.
 *
 * ```ts
 * // vite.config.ts
 * import { hexaUiStyles } from '@reformer/kit-hexa-ui/vite';
 * export default defineConfig({ plugins: [react(), hexaUiStyles()] });
 * ```
 *
 * Правило ограничения и почему оно такое — в `./scope-css.mjs`. Здесь — где его применить:
 *
 * - **`styles.css` HexaUI** (его импортирует вход кита) — хуком `transform` обычного порядка:
 *   он идёт после `vite:css`, то есть видит таблицу уже с развёрнутыми `@import` (xterm,
 *   react-diff-view), и до `vite:css-post`, который превращает её в модуль. Одинаково в dev
 *   и в сборке.
 * - **CSS-модули компонентов** (`*.module.scss.js`, вставка через `style-inject`) — это JS
 *   из `node_modules`. В сборке их видит тот же `transform`, а в dev они уходят в предсборку
 *   зависимостей esbuild, мимо хуков Vite, — поэтому то же правило ставится и плагином esbuild
 *   в `optimizeDeps`. Имя плагина входит в хеш предсборки: подключение плагина пересобирает
 *   её само.
 *
 * Без этого плагина кит работает, но CSS HexaUI глобален. В билдере плагин не нужен: там стили
 * кита изолирует оболочка (`styles.isolation: "scoped"` манифеста).
 *
 * @module reformer/kit-hexa-ui/vite
 */

import { readFile } from 'node:fs/promises';
import { HEXA_SCOPE, HEXA_SCOPE_ATTRIBUTE, scopeHexaCss, scopeInjectedCss } from './scope-css.mjs';

export { HEXA_SCOPE, HEXA_SCOPE_ATTRIBUTE, scopeHexaCss, scopeInjectedCss };

/** Готовая таблица HexaUI — ресет antd и стили компонентов. */
const GLOBAL_STYLE =
  /[\\/]@kaspersky[\\/]hexa-ui[\\/]design-system[\\/]global-style[\\/]styles\.css$/;

/** CSS-модуль компонента HexaUI: вставляет свою таблицу через `style-inject` при импорте. */
const INJECTED_MODULE = /[\\/]@kaspersky[\\/]hexa-ui[\\/].*\.module\.scss\.js$/;

/**
 * Зависимости, которые Vite иначе нашёл бы посреди работы и перезагрузил бы страницу:
 * CommonJS antd/rc-*, styled-components и подпути, которые поля кита грузят через `import()`.
 */
const OPTIMIZE_INCLUDE = [
  '@kaspersky/hexa-ui/design-system',
  '@kaspersky/hexa-ui/rich-text-editor',
  '@kaspersky/hexa-ui/code-viewer',
  '@kaspersky/hexa-ui/datepicker',
  '@preact/signals-core',
  'styled-components',
  'react-is',
];

/** Путь модуля без запроса Vite (`?direct`, `?inline`, `?v=…`). */
const fileOf = (/** @type {string} */ id) => id.split('?', 1)[0];

/** @returns {import('esbuild').Plugin} */
function injectedCssEsbuildPlugin() {
  return {
    name: 'reformer:hexa-ui-styles',
    setup(build) {
      build.onLoad({ filter: INJECTED_MODULE }, async (args) => {
        const code = await readFile(args.path, 'utf8');
        return { contents: scopeInjectedCss(code) ?? code, loader: 'js' };
      });
    },
  };
}

/** @returns {import('vite').Plugin} */
export function hexaUiStyles() {
  return {
    name: 'reformer:hexa-ui-styles',
    config() {
      return {
        optimizeDeps: {
          include: OPTIMIZE_INCLUDE,
          esbuildOptions: { plugins: [injectedCssEsbuildPlugin()] },
        },
      };
    },
    transform(code, id) {
      const file = fileOf(id);
      if (GLOBAL_STYLE.test(file)) return { code: scopeHexaCss(code, { from: file }), map: null };
      if (INJECTED_MODULE.test(file)) {
        const scoped = scopeInjectedCss(code);
        return scoped === null ? null : { code: scoped, map: null };
      }
      return null;
    },
  };
}

export default hexaUiStyles;
