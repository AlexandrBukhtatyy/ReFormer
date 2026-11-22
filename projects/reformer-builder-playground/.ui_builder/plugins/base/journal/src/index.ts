/**
 * Публичная поверхность плагина журнала: то, что берут стенды состава, и ничего больше.
 *
 * Виды панели, правила группировки и ленты — внутреннее и меняется без согласования.
 *
 * @module plugins/base/journal/index
 */

export { createJournalPlugin, JOURNAL_PANEL_ID, JOURNAL_PLUGIN_ID } from './plugin';
export type { JournalPluginOptions } from './plugin';
export { JOURNAL_MESSAGES } from './messages';
export type { JournalHost, Translate } from './host';
