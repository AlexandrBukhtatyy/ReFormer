/**
 * Публичная поверхность плагина «Превью приложением»: то, что берут стенды состава.
 *
 * Контракт — возможность `reformer.app.preview` и имя рамки — живёт в SDK
 * (`@reformer/builder-plugin-api`): оболочка, встроенная в приложение, даёт возможность,
 * не импортируя этот каталог.
 *
 * @module plugins/base/app-preview/index
 */

export { APP_PREVIEW_PANEL_ID, APP_PREVIEW_PLUGIN_ID, createAppPreviewPlugin } from './plugin';
export { APP_PREVIEW_MESSAGES } from './messages';
